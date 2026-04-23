import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/matches/[id]/reset-scores — erase all set scores and reset match to scheduled
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sb = getSupabaseAdmin();

  // Delete all set scores for this match
  const { error: setsError } = await sb
    .from("match_sets")
    .delete()
    .eq("match_id", id);

  if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 });

  // Reset match status to scheduled, clear timestamps
  const { error: matchError } = await sb
    .from("matches")
    .update({ status: "scheduled", start_time: null, end_time: null })
    .eq("id", id);

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
