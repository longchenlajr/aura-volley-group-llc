import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/brackets/undo — undo a bracket match result with cascade
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { match_id } = body as { match_id: string };

  if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().rpc("undo_bracket_match", {
    target_match_id: match_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, matches_cleared: data });
}
