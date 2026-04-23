import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isSetComplete } from "@/lib/score-format";

// PUT /api/admin/brackets/[match_id]/score — admin bracket score override
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ match_id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { match_id } = await params;
  const body = await req.json();
  const { team_a_score, team_b_score } = body as { team_a_score: number; team_b_score: number };

  if (team_a_score == null || team_b_score == null || team_a_score < 0 || team_b_score < 0) {
    return NextResponse.json({ error: "Invalid scores" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Get bracket points_per_set
  const { data: match } = await sb
    .from("bracket_matches")
    .select("id, bracket_id")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { data: bracket } = await sb
    .from("brackets")
    .select("points_per_set")
    .eq("id", match.bracket_id)
    .single();

  const pps = bracket?.points_per_set ?? 15;

  // Upsert score
  const { error: upsertErr } = await sb
    .from("bracket_match_sets")
    .upsert({
      bracket_match_id: match_id,
      set_number: 1,
      team_a_score,
      team_b_score,
      submitted_by: "admin",
      submitted_at: now,
    }, { onConflict: "bracket_match_id,set_number" });

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  // Check if match is complete
  const complete = isSetComplete(team_a_score, team_b_score, pps);

  if (complete) {
    await sb.from("bracket_matches").update({
      status: "complete",
      end_time: now,
    }).eq("id", match_id);

    // Propagate winner + assign work team
    try {
      await sb.rpc("propagate_bracket_winner", { completed_match_id: match_id });
      await sb.rpc("assign_bracket_work_team", { completed_match_id: match_id });
    } catch (err) {
      console.error("Bracket propagation error:", err);
    }
  } else {
    const { data: current } = await sb.from("bracket_matches").select("start_time").eq("id", match_id).single();
    const updates: Record<string, unknown> = { status: "in_progress" };
    if (!current?.start_time) updates.start_time = now;
    await sb.from("bracket_matches").update(updates).eq("id", match_id);
  }

  return NextResponse.json({ ok: true, complete });
}
