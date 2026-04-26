import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/public/team-count?tournament=tournament-id
// Returns { count: number } — aggregate only, no PII
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");

  if (!tournamentId) {
    return NextResponse.json({ error: "Missing tournament parameter" }, { status: 400 });
  }

  const { count, error } = await getSupabaseAdmin()
    .from("teams")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
