import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generatePoolMatches, validateMatches } from "@/lib/match-generation";
import { generateMatchToken, tokenExpiryForTournament } from "@/lib/tokens";
import { getTournament } from "@/lib/tournaments";

// GET /api/admin/matches?tournament=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("matches")
    .select(`
      *,
      team_a:teams!matches_team_a_id_fkey(id, team_name, seed),
      team_b:teams!matches_team_b_id_fkey(id, team_name, seed),
      work_team:teams!matches_work_team_id_fkey(id, team_name),
      pool:pools!matches_pool_id_fkey(id, pool_label, court_number)
    `)
    .eq("tournament_id", tournamentId)
    .order("pool_id")
    .order("match_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get seed_in_pool for each team
  const poolIds = [...new Set((data ?? []).map((m) => m.pool_id).filter(Boolean))];
  let seedMap = new Map<string, number>();
  if (poolIds.length > 0) {
    const { data: pts } = await sb
      .from("pool_teams")
      .select("team_id, seed_in_pool")
      .in("pool_id", poolIds);
    if (pts) {
      seedMap = new Map(pts.map((pt) => [pt.team_id, pt.seed_in_pool]));
    }
  }

  // Fetch tokens and scores
  const matchIds = (data ?? []).map((m) => m.id);
  let tokenMap = new Map<string, string>();
  let scoreMap = new Map<string, Array<{ set_number: number; team_a_score: number; team_b_score: number }>>();

  if (matchIds.length > 0) {
    const { data: tokens } = await sb.from("match_tokens").select("match_id, token").in("match_id", matchIds);
    if (tokens) tokenMap = new Map(tokens.map((t) => [t.match_id, t.token]));

    const { data: scores } = await sb.from("match_sets").select("match_id, set_number, team_a_score, team_b_score").in("match_id", matchIds).order("set_number");
    if (scores) {
      for (const s of scores) {
        if (!scoreMap.has(s.match_id)) scoreMap.set(s.match_id, []);
        scoreMap.get(s.match_id)!.push(s);
      }
    }
  }

  const matches = (data ?? []).map((m) => ({
    match: {
      id: m.id,
      tournament_id: m.tournament_id,
      pool_id: m.pool_id,
      bracket_round: m.bracket_round,
      court_number: m.court_number,
      match_order: m.match_order,
      status: m.status,
      start_time: m.start_time,
      end_time: m.end_time,
    },
    team_a: {
      id: (m.team_a as unknown as { id: string })?.id,
      team_name: (m.team_a as unknown as { team_name: string })?.team_name ?? "Unknown",
      seed_in_pool: seedMap.get(m.team_a_id) ?? 0,
    },
    team_b: {
      id: (m.team_b as unknown as { id: string })?.id,
      team_name: (m.team_b as unknown as { team_name: string })?.team_name ?? "Unknown",
      seed_in_pool: seedMap.get(m.team_b_id) ?? 0,
    },
    work_team: m.work_team_id ? {
      id: (m.work_team as unknown as { id: string })?.id,
      team_name: (m.work_team as unknown as { team_name: string })?.team_name ?? "Unknown",
    } : null,
    pool: {
      id: (m.pool as unknown as { id: string })?.id,
      pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
      court_number: (m.pool as unknown as { court_number: number })?.court_number ?? 0,
    },
    token: tokenMap.get(m.id) ?? null,
    sets: scoreMap.get(m.id) ?? [],
  }));

  return NextResponse.json({ matches });
}

// POST /api/admin/matches — generate matches for all pools
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tournament_id } = body as { tournament_id: string };
  if (!tournament_id) return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Check if matches already exist
  const { count: existingCount } = await sb
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournament_id);

  if ((existingCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Matches already exist for this tournament. Delete them first." },
      { status: 409 },
    );
  }

  // Get pools with teams
  const { data: pools } = await sb
    .from("pools")
    .select("id, pool_label, court_number")
    .eq("tournament_id", tournament_id)
    .order("court_number");

  if (!pools?.length) {
    return NextResponse.json({ error: "No pools found. Generate pools first." }, { status: 400 });
  }

  const poolIds = pools.map((p) => p.id);
  const { data: poolTeams } = await sb
    .from("pool_teams")
    .select("pool_id, team_id, seed_in_pool")
    .in("pool_id", poolIds)
    .order("seed_in_pool");

  if (!poolTeams?.length) {
    return NextResponse.json({ error: "No teams assigned to pools." }, { status: 400 });
  }

  // Generate matches per pool
  const allMatches: Array<{
    tournament_id: string;
    pool_id: string;
    team_a_id: string;
    team_b_id: string;
    work_team_id: string | null;
    court_number: number;
    match_order: number;
  }> = [];

  for (const pool of pools) {
    const teams = poolTeams
      .filter((pt) => pt.pool_id === pool.id)
      .map((pt) => ({ team_id: pt.team_id, seed_in_pool: pt.seed_in_pool }));

    if (teams.length < 3) {
      return NextResponse.json(
        { error: `Pool ${pool.pool_label} has fewer than 3 teams.` },
        { status: 400 },
      );
    }

    const generated = generatePoolMatches({
      pool_id: pool.id,
      court_number: pool.court_number,
      teams,
    });

    // Sanity check
    const teamIds = teams.map((t) => t.team_id);
    const check = validateMatches(generated, teamIds);
    if (!check.valid) {
      return NextResponse.json(
        { error: `Match generation failed for Pool ${pool.pool_label}: ${check.error}` },
        { status: 500 },
      );
    }

    for (const m of generated) {
      allMatches.push({
        tournament_id,
        pool_id: pool.id,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        work_team_id: m.work_team_id,
        court_number: m.court_number,
        match_order: m.match_order,
      });
    }
  }

  const { data: insertedMatches, error: insertError } = await sb
    .from("matches")
    .insert(allMatches)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Create tokens for each match
  const tournament = getTournament(tournament_id);
  const expiresAt = tournament
    ? tokenExpiryForTournament(tournament.date).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const tokenRows = (insertedMatches ?? []).map((m) => ({
    match_id: m.id,
    token: generateMatchToken(),
    expires_at: expiresAt,
  }));

  if (tokenRows.length > 0) {
    const { error: tokenError } = await sb.from("match_tokens").insert(tokenRows);
    if (tokenError) {
      console.error("Failed to create match tokens:", tokenError);
    }
  }

  return NextResponse.json({ ok: true, matchCount: insertedMatches?.length ?? 0 });
}

// DELETE /api/admin/matches?tournament=X
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("matches")
    .delete()
    .eq("tournament_id", tournamentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
