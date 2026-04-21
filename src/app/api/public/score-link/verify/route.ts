import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Rate limiter: 5 attempts per IP per match per hour
const verifyRateMap = new Map<string, { count: number; resetAt: number }>();
function checkVerifyRate(ip: string, matchId: string): boolean {
  const key = `${ip}:${matchId}`;
  const now = Date.now();
  const entry = verifyRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    verifyRateMap.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// POST /api/public/score-link/verify
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const body = await req.json();
  const { match_id, email } = body as { match_id: string; email: string };

  if (!match_id || !email) {
    return NextResponse.json({ error: "Missing match_id or email" }, { status: 400 });
  }

  if (!checkVerifyRate(ip, match_id)) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please try again later." },
      { status: 429 },
    );
  }

  const sb = getSupabaseAdmin();

  // Get match and its work team
  const { data: match } = await sb
    .from("matches")
    .select("id, work_team_id")
    .eq("id", match_id)
    .single();

  if (!match?.work_team_id) {
    return NextResponse.json({ error: "No work team assigned to this match." }, { status: 400 });
  }

  // Check if email matches any player on the work team
  const { data: players } = await sb
    .from("players")
    .select("email")
    .eq("team_id", match.work_team_id);

  const emailLower = email.toLowerCase().trim();
  const matched = (players ?? []).some(
    (p) => p.email && p.email.toLowerCase().trim() === emailLower,
  );

  if (!matched) {
    // Also check team contact_email
    const { data: team } = await sb
      .from("teams")
      .select("contact_email")
      .eq("id", match.work_team_id)
      .single();

    if (!team?.contact_email || team.contact_email.toLowerCase().trim() !== emailLower) {
      return NextResponse.json(
        { error: "That email doesn't match a player on the working team. Please check with an admin." },
        { status: 403 },
      );
    }
  }

  // Fetch the token for this match
  const { data: tokenRow } = await sb
    .from("match_tokens")
    .select("token")
    .eq("match_id", match_id)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "No score link found for this match. Contact an admin." }, { status: 404 });
  }

  return NextResponse.json({ token: tokenRow.token });
}
