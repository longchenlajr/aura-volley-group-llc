import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// PATCH: update team fields (seed, checked_in, team_name, contact_phone, players)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = getSupabaseAdmin();

  const teamUpdates: Record<string, unknown> = {};
  if ("seed" in body) teamUpdates.seed = body.seed;
  if ("checked_in" in body) teamUpdates.checked_in = body.checked_in;
  if ("team_name" in body) teamUpdates.team_name = body.team_name;
  if ("contact_phone" in body) teamUpdates.contact_phone = body.contact_phone;
  if ("contact_email" in body) teamUpdates.contact_email = body.contact_email;

  if (Object.keys(teamUpdates).length > 0) {
    const { error } = await supabase
      .from("teams")
      .update(teamUpdates)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update players if provided
  if ("players" in body && Array.isArray(body.players)) {
    for (const p of body.players as { id: string; name: string; email: string | null }[]) {
      const { error } = await supabase
        .from("players")
        .update({ name: p.name, email: p.email || null })
        .eq("id", p.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  if (Object.keys(teamUpdates).length === 0 && !body.players) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: remove team (players cascade)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await getSupabaseAdmin().from("teams").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
