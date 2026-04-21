import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isSetComplete } from "@/lib/score-format";
import { getRoundLabel } from "@/lib/bracket-generation";

// Rate limiter
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRate(token: string): boolean {
  const now = Date.now();
  const e = rateMap.get(token);
  if (!e || now > e.resetAt) { rateMap.set(token, { count: 1, resetAt: now + 60000 }); return true; }
  if (e.count >= 10) return false;
  e.count++;
  return true;
}

// GET /api/bracket-score/[token]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = getSupabaseAdmin();

  const { data: tokenRow } = await sb
    .from("bracket_match_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (!tokenRow) return NextResponse.json({ token_valid: false, reason: "not_found" });
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ token_valid: false, reason: "expired" });

  if (!tokenRow.last_used_at) {
    await sb.from("bracket_match_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);
  }

  const { data: match } = await sb
    .from("bracket_matches")
    .select(`
      id, bracket_id, round_number, match_position, court_number, match_order, status,
      team_a:teams!bracket_matches_team_a_id_fkey(id, team_name),
      team_b:teams!bracket_matches_team_b_id_fkey(id, team_name),
      work_team:teams!bracket_matches_work_team_id_fkey(id, team_name),
      bracket:brackets!bracket_matches_bracket_id_fkey(bracket_type, points_per_set)
    `)
    .eq("id", tokenRow.bracket_match_id)
    .single();

  if (!match) return NextResponse.json({ token_valid: false, reason: "not_found" });

  const bracket = match.bracket as unknown as { bracket_type: string; points_per_set: number };

  // Count total rounds for label
  const { data: allSlots } = await sb
    .from("bracket_slots")
    .select("round_number")
    .eq("bracket_id", match.bracket_id);
  const totalRounds = Math.max(...(allSlots ?? []).map((s) => s.round_number), 1);

  // Get existing score
  const { data: sets } = await sb
    .from("bracket_match_sets")
    .select("set_number, team_a_score, team_b_score, submitted_at")
    .eq("bracket_match_id", match.id);

  return NextResponse.json({
    token_valid: true,
    match: {
      id: match.id,
      bracket_type: bracket.bracket_type,
      round_label: getRoundLabel(match.round_number, totalRounds),
      court_number: match.court_number,
      match_order: match.match_order,
      points_per_set: bracket.points_per_set,
      team_a: match.team_a as unknown as { id: string; team_name: string },
      team_b: match.team_b as unknown as { id: string; team_name: string },
      work_team: match.work_team as unknown as { id: string; team_name: string } | null,
      status: match.status,
    },
    existing_sets: sets ?? [],
  });
}

// POST /api/bracket-score/[token]
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!checkRate(token)) return NextResponse.json({ error: "Too many submissions." }, { status: 429 });

  const sb = getSupabaseAdmin();

  const { data: tokenRow } = await sb.from("bracket_match_tokens").select("*").eq("token", token).single();
  if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "Token expired" }, { status: 403 });

  const body = await req.json();
  const { team_a_score, team_b_score } = body as { team_a_score: number; team_b_score: number };

  if (team_a_score == null || team_b_score == null || team_a_score < 0 || team_b_score < 0) {
    return NextResponse.json({ error: "Invalid scores" }, { status: 400 });
  }
  if (team_a_score === 0 && team_b_score === 0) {
    return NextResponse.json({ error: "Score cannot be 0-0" }, { status: 400 });
  }

  const { data: match } = await sb
    .from("bracket_matches")
    .select("id, bracket_id, work_team_id, court_number, match_order, slot_a_id, slot_b_id")
    .eq("id", tokenRow.bracket_match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Get bracket points_per_set
  const { data: bracket } = await sb
    .from("brackets")
    .select("points_per_set")
    .eq("id", match.bracket_id)
    .single();

  const pps = bracket?.points_per_set ?? 15;

  // Check 10-min edit window
  const { data: existing } = await sb
    .from("bracket_match_sets")
    .select("submitted_at")
    .eq("bracket_match_id", match.id)
    .eq("set_number", 1)
    .single();

  if (existing?.submitted_at) {
    const elapsed = Date.now() - new Date(existing.submitted_at).getTime();
    if (elapsed > 10 * 60 * 1000) {
      return NextResponse.json({ error: "Score locked. Contact admin." }, { status: 403 });
    }
  }

  // Upsert score
  const { error: upsertErr } = await sb
    .from("bracket_match_sets")
    .upsert({
      bracket_match_id: match.id,
      set_number: 1,
      team_a_score,
      team_b_score,
      submitted_by: "work_team",
      submitted_by_team_id: match.work_team_id,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "bracket_match_id,set_number" });

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  // Check if match is complete
  const complete = isSetComplete(team_a_score, team_b_score, pps);

  if (complete) {
    await sb.from("bracket_matches").update({
      status: "complete",
      end_time: new Date().toISOString(),
    }).eq("id", match.id);

    // Propagate winner + assign work team via RPCs
    try {
      await sb.rpc("propagate_bracket_winner", { completed_match_id: match.id });
      await sb.rpc("assign_bracket_work_team", { completed_match_id: match.id });
    } catch (err) {
      console.error("Bracket propagation error:", err);
    }
  } else {
    await sb.from("bracket_matches").update({ status: "in_progress" }).eq("id", match.id);
  }

  return NextResponse.json({ ok: true, complete });
}
