import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateForfeitScores } from "@/lib/forfeit-handling";

// POST /api/admin/teams/[id]/withdraw — soft-delete team, insert forfeit scores
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: teamId } = await params;
  const sb = getSupabaseAdmin();

  // Verify team exists and isn't already withdrawn
  const { data: team } = await sb
    .from("teams")
    .select("id, team_name, tournament_id, withdrawn_at")
    .eq("id", teamId)
    .single();

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.withdrawn_at) return NextResponse.json({ error: "Team already withdrawn" }, { status: 409 });

  // Find all scheduled matches involving this team
  const { data: scheduledMatches } = await sb
    .from("matches")
    .select("id, team_a_id, team_b_id, pool_id")
    .eq("tournament_id", team.tournament_id)
    .eq("status", "scheduled")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);

  // Get pool sizes for forfeit score calculation
  const poolIds = [...new Set((scheduledMatches ?? []).map((m) => m.pool_id).filter(Boolean))];
  const poolSizeMap = new Map<string, number>();

  if (poolIds.length > 0) {
    for (const poolId of poolIds) {
      const { count } = await sb
        .from("pool_teams")
        .select("*", { count: "exact", head: true })
        .eq("pool_id", poolId);
      poolSizeMap.set(poolId, count ?? 4);
    }
  }

  // Generate forfeit scores
  const matchInputs = (scheduledMatches ?? []).map((m) => ({
    match_id: m.id,
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    pool_size: poolSizeMap.get(m.pool_id) ?? 4,
  }));

  const forfeitScores = generateForfeitScores(matchInputs, teamId);

  // 1. Set withdrawn_at on the team
  const { error: withdrawError } = await sb
    .from("teams")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", teamId);

  if (withdrawError) {
    return NextResponse.json({ error: withdrawError.message }, { status: 500 });
  }

  // 2. Insert forfeit scores and update match status
  let forfeitCount = 0;
  for (const forfeit of forfeitScores) {
    for (const set of forfeit.sets) {
      const { error: setError } = await sb
        .from("match_sets")
        .upsert({
          match_id: forfeit.match_id,
          set_number: set.set_number,
          team_a_score: set.team_a_score,
          team_b_score: set.team_b_score,
          submitted_by: "admin",
          is_forfeit: true,
          submitted_at: new Date().toISOString(),
        }, { onConflict: "match_id,set_number" });

      if (setError) {
        console.error(`[FORFEIT] Failed to insert set for match ${forfeit.match_id}:`, setError);
      }
    }

    // Mark match as complete
    const { error: statusError } = await sb
      .from("matches")
      .update({ status: "complete", end_time: new Date().toISOString() })
      .eq("id", forfeit.match_id);

    if (statusError) {
      console.error(`[FORFEIT] Failed to update match status ${forfeit.match_id}:`, statusError);
    } else {
      forfeitCount++;
    }
  }

  // 3. Handle bracket play matches for withdrawn team
  const { data: bracketMatches } = await sb
    .from("bracket_matches")
    .select("id, bracket_id, team_a_id, team_b_id, status, bracket:brackets!bracket_matches_bracket_id_fkey(tournament_id, points_per_set)")
    .eq("tournament_id", team.tournament_id)
    .in("status", ["scheduled", "in_progress"])
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);

  let bracketForfeited = 0;
  if (bracketMatches?.length) {
    for (const bMatch of bracketMatches) {
      const bracket = bMatch.bracket as unknown as { tournament_id: string; points_per_set: number };
      const pps = bracket?.points_per_set ?? 15;
      const isTeamA = bMatch.team_a_id === teamId;

      // Insert forfeit score
      const { error: forfeitErr } = await sb.from("bracket_match_sets").insert({
        bracket_match_id: bMatch.id,
        set_number: 1,
        team_a_score: isTeamA ? 0 : pps,
        team_b_score: isTeamA ? pps : 0,
        submitted_by: "admin",
        is_forfeit: true,
        submitted_at: new Date().toISOString(),
      });

      if (!forfeitErr) {
        // Mark match as complete
        await sb
          .from("bracket_matches")
          .update({ status: "complete", end_time: new Date().toISOString() })
          .eq("id", bMatch.id);

        // Propagate winner
        try {
          await sb.rpc("propagate_bracket_winner", { completed_match_id: bMatch.id });
        } catch (err) {
          console.error(`[BRACKET FORFEIT] Winner propagation failed for ${bMatch.id}:`, err);
        }

        bracketForfeited++;
      }
    }
  }

  // 4. Check if withdrawn team is work team for any remaining scheduled matches
  const { data: workTeamMatches } = await sb
    .from("matches")
    .select("id, match_order, pool_id, pool:pools!matches_pool_id_fkey(pool_label)")
    .eq("tournament_id", team.tournament_id)
    .eq("status", "scheduled")
    .eq("work_team_id", teamId);

  return NextResponse.json({
    ok: true,
    team_name: team.team_name,
    forfeited_matches: forfeitCount,
    bracket_forfeited_matches: bracketForfeited,
    withdrawn_work_team_matches: (workTeamMatches ?? []).map((m) => ({
      match_id: m.id,
      match_order: m.match_order,
      pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
    })),
  });
}
