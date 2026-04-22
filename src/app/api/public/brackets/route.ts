import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET /api/public/brackets?tournament=X — public bracket view with scores
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabase();

  const { data: brackets } = await sb
    .from("brackets")
    .select("id, bracket_type, points_per_set")
    .eq("tournament_id", tournamentId)
    .order("bracket_type");

  if (!brackets?.length) return NextResponse.json({ brackets: [] });

  const result = [];
  for (const bracket of brackets) {
    const { data: slots } = await sb
      .from("bracket_slots")
      .select("round_number, slot_position, is_bye, team_id, teams(team_name)")
      .eq("bracket_id", bracket.id)
      .order("round_number")
      .order("slot_position");

    const { data: matches } = await sb
      .from("bracket_matches")
      .select(`
        id, round_number, match_position, court_number, match_order, status,
        team_a_id, team_b_id,
        team_a:teams!bracket_matches_team_a_id_fkey(team_name),
        team_b:teams!bracket_matches_team_b_id_fkey(team_name),
        work_team:teams!bracket_matches_work_team_id_fkey(team_name)
      `)
      .eq("bracket_id", bracket.id)
      .order("match_order");

    // Fetch scores for bracket matches
    const matchIds = (matches ?? []).map((m) => m.id);
    const scoresMap = new Map<string, { team_a_score: number; team_b_score: number }>();
    if (matchIds.length > 0) {
      const { data: sets } = await sb
        .from("bracket_match_sets")
        .select("bracket_match_id, team_a_score, team_b_score")
        .in("bracket_match_id", matchIds);
      if (sets) {
        for (const s of sets) {
          scoresMap.set(s.bracket_match_id, { team_a_score: s.team_a_score, team_b_score: s.team_b_score });
        }
      }
    }

    result.push({
      bracket_type: bracket.bracket_type,
      points_per_set: bracket.points_per_set,
      slots: (slots ?? []).map((s) => ({
        round_number: s.round_number,
        slot_position: s.slot_position,
        team_name: (s.teams as unknown as { team_name: string })?.team_name ?? null,
        team_id: s.team_id,
        is_bye: s.is_bye,
      })),
      matches: (matches ?? []).map((m) => {
        const score = scoresMap.get(m.id);
        return {
          match_id: m.id,
          round_number: m.round_number,
          match_position: m.match_position,
          court_number: m.court_number,
          match_order: m.match_order,
          status: m.status,
          team_a: (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD",
          team_b: (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD",
          team_a_id: m.team_a_id,
          team_b_id: m.team_b_id,
          score_a: score?.team_a_score ?? null,
          score_b: score?.team_b_score ?? null,
          work_team: (m.work_team as unknown as { team_name: string })?.team_name ?? null,
        };
      }),
    });
  }

  return NextResponse.json({ brackets: result });
}
