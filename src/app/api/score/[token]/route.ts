import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isSetComplete, isMatchComplete, getMatchFormat } from "@/lib/score-format";
import { getTournament } from "@/lib/tournaments";

// Rate limiter per token (120/min for live per-point scoring)
const tokenRateMap = new Map<string, { count: number; resetAt: number }>();
function checkTokenRate(token: string): boolean {
  const now = Date.now();
  const entry = tokenRateMap.get(token);
  if (!entry || now > entry.resetAt) {
    tokenRateMap.set(token, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 120) return false;
  entry.count++;
  return true;
}

// GET /api/score/[token] — fetch match details for score submission
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = getSupabaseAdmin();

  // Look up token
  const { data: tokenRow } = await sb
    .from("match_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ token_valid: false, reason: "not_found" });
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ token_valid: false, reason: "expired" });
  }

  // Update last_used_at
  if (!tokenRow.last_used_at) {
    await sb.from("match_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);
  }

  // Fetch match with team data
  const { data: match } = await sb
    .from("matches")
    .select(`
      id, pool_id, court_number, match_order, status, tournament_id,
      team_a:teams!matches_team_a_id_fkey(id, team_name),
      team_b:teams!matches_team_b_id_fkey(id, team_name),
      work_team:teams!matches_work_team_id_fkey(id, team_name),
      pool:pools!matches_pool_id_fkey(pool_label, court_number)
    `)
    .eq("id", tokenRow.match_id)
    .single();

  if (!match) {
    return NextResponse.json({ token_valid: false, reason: "not_found" });
  }

  // Get pool size for format
  const { count: poolTeamCount } = await sb
    .from("pool_teams")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", match.pool_id);

  const poolSize = poolTeamCount ?? 4;
  const awesomefest = getTournament(match.tournament_id)?.awesomefest ?? false;
  const format = getMatchFormat(poolSize, awesomefest);

  // Get total matches in this pool for "Match X of Y"
  const { count: totalMatches } = await sb
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", match.pool_id)
    .eq("court_number", match.court_number);

  // Fetch existing set scores
  const { data: sets } = await sb
    .from("match_sets")
    .select("set_number, team_a_score, team_b_score, submitted_at")
    .eq("match_id", match.id)
    .order("set_number");

  return NextResponse.json({
    token_valid: true,
    match: {
      id: match.id,
      pool_label: (match.pool as unknown as { pool_label: string })?.pool_label ?? "",
      court_number: match.court_number,
      match_order: match.match_order,
      total_matches: totalMatches ?? 0,
      team_a: match.team_a as unknown as { id: string; team_name: string },
      team_b: match.team_b as unknown as { id: string; team_name: string },
      work_team: match.work_team as unknown as { id: string; team_name: string } | null,
      status: match.status,
    },
    format,
    existing_sets: sets ?? [],
  });
}

// POST /api/score/[token] — submit set scores
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!checkTokenRate(token)) {
    return NextResponse.json({ error: "Too many submissions. Wait a moment." }, { status: 429 });
  }

  const sb = getSupabaseAdmin();

  // Validate token
  const { data: tokenRow } = await sb
    .from("match_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "This token has expired" }, { status: 403 });
  }

  const body = await req.json();
  const { sets } = body as {
    sets: Array<{ set_number: number; team_a_score: number; team_b_score: number }>;
  };

  if (!sets?.length) return NextResponse.json({ error: "No scores provided" }, { status: 400 });

  // Get match and pool size for format
  const { data: match } = await sb
    .from("matches")
    .select("id, pool_id, work_team_id, tournament_id")
    .eq("id", tokenRow.match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { count: poolTeamCount } = await sb
    .from("pool_teams")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", match.pool_id);

  const awesomefest = getTournament(match.tournament_id)?.awesomefest ?? false;
  const format = getMatchFormat(poolTeamCount ?? 4, awesomefest);

  // Validate and upsert each set
  const now = new Date().toISOString();
  for (const set of sets) {
    if (set.set_number < 1 || set.set_number > format.sets) {
      return NextResponse.json({ error: `Invalid set number: ${set.set_number}` }, { status: 400 });
    }
    if (set.team_a_score < 0 || set.team_b_score < 0) {
      return NextResponse.json({ error: "Scores must be non-negative" }, { status: 400 });
    }
    if (set.team_a_score > 99 || set.team_b_score > 99) {
      return NextResponse.json({ error: "Score exceeds maximum" }, { status: 400 });
    }

    // Upsert set score (live scoring — no edit window for active sets)
    if (set.team_a_score === 0 && set.team_b_score === 0) continue;

    const { error } = await sb
      .from("match_sets")
      .upsert({
        match_id: match.id,
        set_number: set.set_number,
        team_a_score: set.team_a_score,
        team_b_score: set.team_b_score,
        submitted_by: "work_team",
        submitted_by_team_id: match.work_team_id,
        submitted_at: now,
      }, { onConflict: "match_id,set_number" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Determine match status
  const { data: allSets } = await sb
    .from("match_sets")
    .select("set_number, team_a_score, team_b_score")
    .eq("match_id", match.id)
    .order("set_number");

  const complete = isMatchComplete(allSets ?? [], format);
  const newStatus = complete ? "complete" : "in_progress";

  // Set start_time on first score, end_time on completion
  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "in_progress") {
    // Only set start_time if not already set
    const { data: current } = await sb.from("matches").select("start_time").eq("id", match.id).single();
    if (!current?.start_time) updates.start_time = now;
  }
  if (complete) updates.end_time = now;

  await sb.from("matches").update(updates).eq("id", match.id);

  return NextResponse.json({ ok: true, status: newStatus, complete });
}
