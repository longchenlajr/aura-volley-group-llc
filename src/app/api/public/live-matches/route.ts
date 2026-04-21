import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getMatchFormat, isSetComplete, matchWinner } from "@/lib/score-format";

// GET /api/public/live-matches?tournament=X
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabase();

  // Get all matches with team names + pool info
  const { data: allMatches } = await sb
    .from("matches")
    .select(`
      id, pool_id, team_a_id, team_b_id, court_number, match_order, status, end_time,
      team_a:teams!matches_team_a_id_fkey(id, team_name),
      team_b:teams!matches_team_b_id_fkey(id, team_name),
      pool:pools!matches_pool_id_fkey(id, pool_label, court_number)
    `)
    .eq("tournament_id", tournamentId)
    .order("match_order");

  if (!allMatches?.length) {
    return NextResponse.json({
      in_progress: [],
      recently_complete: [],
      upcoming: [],
      any_started: false,
      last_updated: new Date().toISOString(),
    });
  }

  // Get pool team counts for format
  const poolIds = [...new Set(allMatches.map((m) => m.pool_id).filter(Boolean))];
  const poolSizeMap = new Map<string, number>();
  if (poolIds.length > 0) {
    for (const pid of poolIds) {
      const { count } = await sb
        .from("pool_teams")
        .select("*", { count: "exact", head: true })
        .eq("pool_id", pid);
      poolSizeMap.set(pid, count ?? 4);
    }
  }

  // Get all match sets
  const matchIds = allMatches.map((m) => m.id);
  const setsMap = new Map<string, Array<{ team_a_score: number; team_b_score: number; set_number: number }>>();

  if (matchIds.length > 0) {
    const { data: sets } = await sb
      .from("match_sets")
      .select("match_id, set_number, team_a_score, team_b_score")
      .in("match_id", matchIds)
      .order("set_number");

    if (sets) {
      for (const s of sets) {
        if (!setsMap.has(s.match_id)) setsMap.set(s.match_id, []);
        setsMap.get(s.match_id)!.push(s);
      }
    }
  }

  const any_started = allMatches.some((m) => m.status !== "scheduled");

  // In progress
  const in_progress = allMatches
    .filter((m) => m.status === "in_progress")
    .map((m) => {
      const poolSize = poolSizeMap.get(m.pool_id) ?? 4;
      const format = getMatchFormat(poolSize);
      const sets = setsMap.get(m.id) ?? [];

      return {
        match_id: m.id,
        pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
        court_number: m.court_number,
        match_order: m.match_order,
        team_a: { id: (m.team_a as unknown as { id: string })?.id, name: (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD" },
        team_b: { id: (m.team_b as unknown as { id: string })?.id, name: (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD" },
        current_sets: sets.map((s) => ({
          team_a_score: s.team_a_score,
          team_b_score: s.team_b_score,
          is_complete: isSetComplete(s.team_a_score, s.team_b_score, format.pointsPerSet),
        })),
        format: { sets: format.sets, points_per_set: format.pointsPerSet },
      };
    });

  // Recently complete (within 30 min)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const recently_complete = allMatches
    .filter((m) => m.status === "complete" && m.end_time && m.end_time > thirtyMinAgo)
    .map((m) => {
      const poolSize = poolSizeMap.get(m.pool_id) ?? 4;
      const format = getMatchFormat(poolSize);
      const sets = setsMap.get(m.id) ?? [];
      const winner = matchWinner(
        sets.map((s, i) => ({ set_number: i + 1, team_a_score: s.team_a_score, team_b_score: s.team_b_score })),
        format,
      );

      return {
        match_id: m.id,
        pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
        court_number: m.court_number,
        team_a: { id: (m.team_a as unknown as { id: string })?.id, name: (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD" },
        team_b: { id: (m.team_b as unknown as { id: string })?.id, name: (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD" },
        final_sets: sets.map((s) => ({ team_a_score: s.team_a_score, team_b_score: s.team_b_score })),
        winner_team_id: winner === "team_a" ? m.team_a_id : winner === "team_b" ? m.team_b_id : null,
        completed_at: m.end_time,
      };
    });

  // Upcoming — next 2 per court that are still scheduled
  const scheduledByPool = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    if (m.status !== "scheduled") continue;
    const key = `${m.pool_id}:${m.court_number}`;
    if (!scheduledByPool.has(key)) scheduledByPool.set(key, []);
    scheduledByPool.get(key)!.push(m);
  }

  const upcoming: Array<{
    match_id: string;
    pool_label: string;
    court_number: number;
    match_order: number;
    team_a: { id: string; name: string };
    team_b: { id: string; name: string };
  }> = [];

  for (const [, courtMatches] of scheduledByPool) {
    const sorted = courtMatches.sort((a, b) => a.match_order - b.match_order);
    for (const m of sorted.slice(0, 2)) {
      upcoming.push({
        match_id: m.id,
        pool_label: (m.pool as unknown as { pool_label: string })?.pool_label ?? "",
        court_number: m.court_number,
        match_order: m.match_order,
        team_a: { id: (m.team_a as unknown as { id: string })?.id, name: (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD" },
        team_b: { id: (m.team_b as unknown as { id: string })?.id, name: (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD" },
      });
    }
  }

  const response = NextResponse.json({
    in_progress,
    recently_complete,
    upcoming,
    any_started,
    last_updated: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=10");
  return response;
}
