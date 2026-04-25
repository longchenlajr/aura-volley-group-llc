import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateMatchToken } from "@/lib/tokens";

// POST /api/admin/brackets/[match_id]/refresh-token — regenerate token for a bracket match
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ match_id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { match_id } = await params;
  const newToken = generateMatchToken();
  const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await getSupabaseAdmin()
    .from("bracket_match_tokens")
    .update({ token: newToken, expires_at: newExpiry })
    .eq("bracket_match_id", match_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, token: newToken });
}
