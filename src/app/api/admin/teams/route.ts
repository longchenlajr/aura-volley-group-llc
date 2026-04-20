import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET: list teams (with players) for a tournament
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) {
    return NextResponse.json(
      { error: "Missing tournament parameter" },
      { status: 400 },
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from("teams")
    .select("*, players(*)")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teams: data });
}
