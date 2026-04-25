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
  // Set new expiry to 24 hours from now so refreshed tokens don't immediately expire
  const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await getSupabaseAdmin()
    .from("match_tokens")
    .update({ token: newToken, expires_at: newExpiry })
    .eq("match_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, token: newToken });
}
