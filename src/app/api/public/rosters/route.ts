import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/public/rosters?tournament=X
// Returns player names grouped by team_id (no emails/phones)
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) {
    return NextResponse.json({ error: "Missing tournament" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: teams } = await sb
    .from("teams")
    .select("id, players(name, is_captain)")
    .eq("tournament_id", tournamentId);

  if (!teams) {
    return NextResponse.json({ rosters: {} });
  }

  // Build map: team_id -> player names (captain first)
  const rosters: Record<string, Array<{ name: string; is_captain: boolean }>> = {};
  for (const t of teams) {
    const players = (t.players as Array<{ name: string; is_captain: boolean }>) ?? [];
    rosters[t.id] = players.sort((a, b) => (b.is_captain ? 1 : 0) - (a.is_captain ? 1 : 0));
  }

  const response = NextResponse.json({ rosters });
  response.headers.set("Cache-Control", "public, max-age=60");
  return response;
}
