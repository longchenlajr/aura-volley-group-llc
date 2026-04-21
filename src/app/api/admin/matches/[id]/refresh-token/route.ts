import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateMatchToken } from "@/lib/tokens";

// POST /api/admin/matches/[id]/refresh-token — regenerate token for a match
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const newToken = generateMatchToken();

  const { error } = await getSupabaseAdmin()
    .from("match_tokens")
    .update({ token: newToken })
    .eq("match_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, token: newToken });
}
