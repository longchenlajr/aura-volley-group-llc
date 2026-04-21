import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// PUT /api/admin/matches/[id]/score — admin score entry (bypasses 10-min window)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { sets } = body as {
    sets: Array<{ set_number: number; team_a_score: number; team_b_score: number }>;
  };

  if (!sets?.length) return NextResponse.json({ error: "No scores" }, { status: 400 });

  const sb = getSupabaseAdmin();

  for (const set of sets) {
    if (set.team_a_score === 0 && set.team_b_score === 0) continue;

    const { error } = await sb
      .from("match_sets")
      .upsert({
        match_id: id,
        set_number: set.set_number,
        team_a_score: set.team_a_score,
        team_b_score: set.team_b_score,
        submitted_by: "admin",
        submitted_at: new Date().toISOString(),
      }, { onConflict: "match_id,set_number" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/matches/[id]/score — clear all scores for a match
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await getSupabaseAdmin()
    .from("match_sets")
    .delete()
    .eq("match_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reset match status
  await getSupabaseAdmin()
    .from("matches")
    .update({ status: "scheduled", end_time: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
