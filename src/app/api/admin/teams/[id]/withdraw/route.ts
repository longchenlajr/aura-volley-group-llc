import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getMatchFormat } from "@/lib/score-format";

// POST /api/admin/teams/[id]/withdraw — soft-delete a team and forfeit its
// remaining pool + bracket matches, all in one atomic RPC.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: teamId } = await params;
  const sb = getSupabaseAdmin();

  const { data: team } = await sb
    .from("teams")
    .select("id, team_name, tournament_id, withdrawn_at")
    .eq("id", teamId)
    .single();

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.withdrawn_at) return NextResponse.json({ error: "Team already withdrawn" }, { status: 409 });

  // Determine the team's pool format so forfeit sets match how the pool is played.
  // (A team belongs to at most one pool; if it isn't pooled yet there are no pool
  // matches and the format is irrelevant.)
  const { data: poolTeam } = await sb
    .from("pool_teams")
    .select("pool_id")
    .eq("team_id", teamId)
    .maybeSingle();

  let poolSize = 4;
  if (poolTeam?.pool_id) {
    const { count } = await sb
      .from("pool_teams")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", poolTeam.pool_id);
    poolSize = count ?? 4;
  }
  const format = getMatchFormat(poolSize);

  // Atomic withdrawal: forfeits pool + bracket matches, handles in-progress and
  // not-yet-populated bracket slots, marks withdrawn last.
  const { data: result, error } = await sb.rpc("withdraw_team", {
    p_team_id: teamId,
    p_points_per_set: format.pointsPerSet,
    p_sets_per_match: format.sets,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = result as { pool_forfeits: number; bracket_forfeits: number };

  // Pool work assignments are display-only and recomputed, so they aren't cleared —
  // report the scheduled pool matches the withdrawn team was set to work so the
  // admin can reassign them at the desk.
  const { data: workTeamMatches } = await sb
    .from("matches")
    .select("id, match_order, pool_id, pool:pools!matches_pool_id_fkey(pool_label)")
    .eq("tournament_id", team.tournament_id)
    .eq("status", "scheduled")
    .eq("work_team_id", teamId);

  return NextResponse.json({
    ok: true,
    team_name: team.team_name,
    forfeited_matches: counts?.pool_forfeits ?? 0,
    bracket_forfeited_matches: counts?.bracket_forfeits ?? 0,
    withdrawn_work_team_matches: (workTeamMatches ?? []).map((m) => ({
      match_id: m.id,
      match_order: m.match_order,
      pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
    })),
  });
}
