import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/brackets/[match_id]/reset-scores — undo with cascade via RPC
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ match_id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { match_id } = await params;
  const sb = getSupabaseAdmin();

  // Use the undo RPC which handles cascade (clears dependent later-round matches)
  const { data, error } = await sb.rpc("undo_bracket_match", {
    target_match_id: match_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, matches_cleared: data });
}
