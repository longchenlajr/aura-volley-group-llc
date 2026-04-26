import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/public/matches?tournament=X — public match schedule with set scores
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("matches")
    .select(`
      id, match_order, court_number, status,
      team_a:teams!matches_team_a_id_fkey(team_name),
      team_b:teams!matches_team_b_id_fkey(team_name),
      work_team:teams!matches_work_team_id_fkey(team_name),
      pool:pools!matches_pool_id_fkey(pool_label, court_number)
    `)
    .eq("tournament_id", tournamentId)
    .order("pool_id")
    .order("match_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch set scores for all matches
  const matchIds = (data ?? []).map((m) => m.id);
  let setsMap = new Map<string, Array<{ set_number: number; team_a_score: number; team_b_score: number }>>();

  if (matchIds.length > 0) {
    const { data: sets } = await sb
      .from("match_sets")
      .select("match_id, set_number, team_a_score, team_b_score")
      .in("match_id", matchIds)
      .order("set_number");

    if (sets) {
      for (const s of sets) {
        if (!setsMap.has(s.match_id)) setsMap.set(s.match_id, []);
        setsMap.get(s.match_id)!.push({ set_number: s.set_number, team_a_score: s.team_a_score, team_b_score: s.team_b_score });
      }
    }
  }

  const matches = (data ?? []).map((m) => ({
    match_id: m.id,
    match_order: m.match_order,
    court_number: m.court_number,
    status: m.status,
    team_a: (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD",
    team_b: (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD",
    work_team: (m.work_team as unknown as { team_name: string })?.team_name ?? null,
    pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
    sets: setsMap.get(m.id) ?? [],
  }));

  return NextResponse.json({ matches });
}
