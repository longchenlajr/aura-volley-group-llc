import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computePoolStandings } from "@/lib/standings";
import { computeOverallStandings } from "@/lib/tournament-standings";
import { generateBracket } from "@/lib/bracket-generation";
import { getMatchFormat } from "@/lib/score-format";
import { generateMatchToken, tokenExpiryForTournament } from "@/lib/tokens";
import { getTournament } from "@/lib/tournaments";

// GET /api/admin/brackets?tournament=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: brackets } = await sb
    .from("brackets")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("bracket_type");

  if (!brackets?.length) return NextResponse.json({ brackets: [] });

  const result = [];
  for (const bracket of brackets) {
    const { data: slots } = await sb
      .from("bracket_slots")
      .select("*, teams(team_name)")
      .eq("bracket_id", bracket.id)
      .order("round_number")
      .order("slot_position");

    const { data: matches } = await sb
      .from("bracket_matches")
      .select(`
        *,
        team_a:teams!bracket_matches_team_a_id_fkey(id, team_name),
        team_b:teams!bracket_matches_team_b_id_fkey(id, team_name),
        work_team:teams!bracket_matches_work_team_id_fkey(id, team_name)
      `)
      .eq("bracket_id", bracket.id)
      .order("match_order");

    // Fetch tokens for bracket matches
    const matchIds = (matches ?? []).map((m) => m.id);
    const tokenMap = new Map<string, string>();
    if (matchIds.length > 0) {
      const { data: tokens } = await sb
        .from("bracket_match_tokens")
        .select("bracket_match_id, token")
        .in("bracket_match_id", matchIds);
      if (tokens) {
        for (const t of tokens) tokenMap.set(t.bracket_match_id, t.token);
      }
    }

    result.push({
      bracket,
      slots: (slots ?? []).map((s) => ({
        ...s,
        team_name: (s.teams as unknown as { team_name: string })?.team_name ?? null,
      })),
      matches: (matches ?? []).map((m) => ({
        ...m,
        team_a_name: (m.team_a as unknown as { team_name: string })?.team_name ?? null,
        team_b_name: (m.team_b as unknown as { team_name: string })?.team_name ?? null,
        work_team_name: (m.work_team as unknown as { team_name: string })?.team_name ?? null,
        token: tokenMap.get(m.id) ?? null,
      })),
    });
  }

  return NextResponse.json({ brackets: result });
}

// POST /api/admin/brackets — generate gold + silver brackets
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tournament_id, gold_cutoff, gold_points_per_set, silver_points_per_set, court_count } = body as {
    tournament_id: string;
    gold_cutoff: number;
    gold_points_per_set: 11 | 15;
    silver_points_per_set: 11 | 15;
    court_count: number;
  };

  if (!tournament_id || !gold_cutoff) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Check if brackets already exist
  const { count } = await sb
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournament_id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Brackets already exist. Delete them first." },
      { status: 409 },
    );
  }

  // Compute overall standings from pool data
  const { data: pools } = await sb
    .from("pools")
    .select("id, pool_label, court_number")
    .eq("tournament_id", tournament_id)
    .order("court_number");

  if (!pools?.length) {
    return NextResponse.json({ error: "No pools found." }, { status: 400 });
  }

  const poolIds = pools.map((p) => p.id);
  const { data: poolTeams } = await sb
    .from("pool_teams")
    .select("pool_id, team_id, seed_in_pool, teams(team_name)")
    .in("pool_id", poolIds)
    .order("seed_in_pool");

  const { data: matches } = await sb
    .from("matches")
    .select("id, pool_id, team_a_id, team_b_id, status")
    .in("pool_id", poolIds);

  const matchIds = (matches ?? []).map((m) => m.id);
  const setsMap = new Map<string, Array<{ team_a_score: number; team_b_score: number }>>();
  if (matchIds.length > 0) {
    const { data: sets } = await sb
      .from("match_sets")
      .select("match_id, team_a_score, team_b_score")
      .in("match_id", matchIds)
      .order("set_number");
    if (sets) {
      for (const s of sets) {
        if (!setsMap.has(s.match_id)) setsMap.set(s.match_id, []);
        setsMap.get(s.match_id)!.push(s);
      }
    }
  }

  // Compute pool standings
  const poolStandings = pools.map((pool) => {
    const teams = (poolTeams ?? [])
      .filter((pt) => pt.pool_id === pool.id)
      .map((pt) => ({
        team_id: pt.team_id,
        team_name: (pt.teams as unknown as { team_name: string })?.team_name ?? "Unknown",
        seed_in_pool: pt.seed_in_pool,
      }));
    const poolMatches = (matches ?? [])
      .filter((m) => m.pool_id === pool.id)
      .map((m) => ({ id: m.id, team_a_id: m.team_a_id, team_b_id: m.team_b_id, sets: setsMap.get(m.id) ?? [], status: m.status }));
    const format = getMatchFormat(teams.length);
    return {
      pool_id: pool.id,
      pool_label: pool.pool_label,
      court_number: pool.court_number,
      standings: computePoolStandings(teams, poolMatches, format),
    };
  });

  const overallStandings = computeOverallStandings(poolStandings);

  // Split into gold and silver
  const goldTeams = overallStandings.filter((t) => t.overall_rank <= gold_cutoff);
  const silverTeams = overallStandings.filter((t) => t.overall_rank > gold_cutoff);

  const courts = court_count || pools.length;

  // Generate brackets
  const goldBracket = generateBracket(goldTeams, "gold", gold_points_per_set, courts);
  const silverBracket = generateBracket(silverTeams, "silver", silver_points_per_set, courts, goldBracket.matches.length);

  // Persist gold bracket
  for (const bracket of [goldBracket, silverBracket]) {
    if (bracket.slots.length === 0) continue;

    const { data: bracketRow, error: bracketErr } = await sb
      .from("brackets")
      .insert({ tournament_id, bracket_type: bracket.bracket_type, points_per_set: bracket.points_per_set })
      .select("id")
      .single();

    if (bracketErr || !bracketRow) {
      return NextResponse.json({ error: bracketErr?.message ?? "Failed to create bracket" }, { status: 500 });
    }

    // Insert slots
    const slotRows = bracket.slots.map((s) => ({
      bracket_id: bracketRow.id,
      round_number: s.round_number,
      slot_position: s.slot_position,
      team_id: s.team_id,
      is_bye: s.is_bye,
    }));

    const { data: insertedSlots, error: slotErr } = await sb
      .from("bracket_slots")
      .insert(slotRows)
      .select("id, round_number, slot_position");

    if (slotErr) {
      return NextResponse.json({ error: slotErr.message }, { status: 500 });
    }

    // Map slot positions to IDs for match references
    const slotIdMap = new Map<string, string>();
    for (const s of insertedSlots ?? []) {
      slotIdMap.set(`${s.round_number}:${s.slot_position}`, s.id);
    }

    // Set source_slot_ids on later-round slots
    // Each pair of round N slots feeds into one round N+1 slot
    const totalRounds = Math.max(...bracket.slots.map((s) => s.round_number));
    for (let round = 2; round <= totalRounds; round++) {
      const prevRoundSlots = (insertedSlots ?? []).filter((s) => s.round_number === round - 1);
      const thisRoundSlots = (insertedSlots ?? []).filter((s) => s.round_number === round);

      for (let i = 0; i < thisRoundSlots.length; i++) {
        const feedA = prevRoundSlots[i * 2];
        const feedB = prevRoundSlots[i * 2 + 1];
        if (feedA && feedB) {
          await sb.from("bracket_slots")
            .update({ source_slot_ids: [feedA.id, feedB.id] })
            .eq("id", thisRoundSlots[i].id);
        }
      }
    }

    // Insert matches
    if (bracket.matches.length > 0) {
      const matchRows = bracket.matches.map((m) => ({
        bracket_id: bracketRow.id,
        round_number: m.round_number,
        match_position: m.match_position,
        slot_a_id: slotIdMap.get(`${m.round_number}:${m.slot_a_position}`) ?? "",
        slot_b_id: slotIdMap.get(`${m.round_number}:${m.slot_b_position}`) ?? "",
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        court_number: m.court_number,
        match_order: m.match_order,
      }));

      const { data: insertedMatches, error: matchErr } = await sb
        .from("bracket_matches")
        .insert(matchRows)
        .select("id");

      if (matchErr) {
        return NextResponse.json({ error: matchErr.message }, { status: 500 });
      }

      // Create tokens for bracket matches
      const tournament = getTournament(tournament_id);
      const expiresAt = tournament
        ? tokenExpiryForTournament(tournament.date).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const tokenRows = (insertedMatches ?? []).map((m) => ({
        bracket_match_id: m.id,
        token: generateMatchToken(),
        expires_at: expiresAt,
      }));

      if (tokenRows.length > 0) {
        const { error: tokenErr } = await sb.from("bracket_match_tokens").insert(tokenRows);
        if (tokenErr) console.error("Failed to create bracket match tokens:", tokenErr);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/brackets?tournament=X
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("brackets")
    .delete()
    .eq("tournament_id", tournamentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
