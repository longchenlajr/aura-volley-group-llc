import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { computePoolStandings } from "@/lib/standings";
import { getMatchFormat } from "@/lib/score-format";

// GET /api/public/standings?tournament=X
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabase();

  // Get pools
  const { data: pools } = await sb
    .from("pools")
    .select("id, pool_label, court_number")
    .eq("tournament_id", tournamentId)
    .order("court_number");

  if (!pools?.length) {
    return NextResponse.json({ pools: [], last_updated: new Date().toISOString() });
  }

  const poolIds = pools.map((p) => p.id);

  // Get pool teams
  const { data: poolTeams } = await sb
    .from("pool_teams")
    .select("pool_id, team_id, seed_in_pool, teams(team_name)")
    .in("pool_id", poolIds)
    .order("seed_in_pool");

  // Get matches with sets
  const { data: matches } = await sb
    .from("matches")
    .select("id, pool_id, team_a_id, team_b_id, status")
    .in("pool_id", poolIds);

  const matchIds = (matches ?? []).map((m) => m.id);
  let setsMap = new Map<string, Array<{ team_a_score: number; team_b_score: number }>>();

  if (matchIds.length > 0) {
    const { data: sets } = await sb
      .from("match_sets")
      .select("match_id, team_a_score, team_b_score, set_number")
      .in("match_id", matchIds)
      .order("set_number");

    if (sets) {
      for (const s of sets) {
        if (!setsMap.has(s.match_id)) setsMap.set(s.match_id, []);
        setsMap.get(s.match_id)!.push({ team_a_score: s.team_a_score, team_b_score: s.team_b_score });
      }
    }
  }

  // Compute standings per pool
  const result = pools.map((pool) => {
    const teams = (poolTeams ?? [])
      .filter((pt) => pt.pool_id === pool.id)
      .map((pt) => ({
        team_id: pt.team_id,
        team_name: (pt.teams as unknown as { team_name: string })?.team_name ?? "Unknown",
        seed_in_pool: pt.seed_in_pool,
      }));

    const poolMatches = (matches ?? [])
      .filter((m) => m.pool_id === pool.id)
      .map((m) => ({
        id: m.id,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        sets: setsMap.get(m.id) ?? [],
        status: m.status,
      }));

    const format = getMatchFormat(teams.length);
    const standings = computePoolStandings(teams, poolMatches, format);

    return {
      pool_id: pool.id,
      pool_label: pool.pool_label,
      court_number: pool.court_number,
      standings,
    };
  });

  const response = NextResponse.json({
    pools: result,
    last_updated: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=10");
  return response;
}
