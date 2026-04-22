import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Rate limiter: 5 attempts per IP per match per hour
const verifyRateMap = new Map<string, { count: number; resetAt: number }>();
function checkVerifyRate(ip: string, matchId: string, matchType: string): boolean {
  const key = `${ip}:${matchType}:${matchId}`;
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
  const { match_id, email, match_type = "pool" } = body as {
    match_id: string;
    email: string;
    match_type?: "pool" | "bracket";
  };

  if (!match_id || !email) {
    return NextResponse.json({ error: "Missing match_id or email" }, { status: 400 });
  }

  if (match_type !== "pool" && match_type !== "bracket") {
    return NextResponse.json({ error: "Invalid match_type" }, { status: 400 });
  }

  if (!checkVerifyRate(ip, match_id, match_type)) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please try again later." },
      { status: 429 },
    );
  }

  const sb = getSupabaseAdmin();

  // Look up match and work team based on match type
  const table = match_type === "bracket" ? "bracket_matches" : "matches";
  const { data: match } = await sb
    .from(table)
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

  // Fetch the token based on match type
  let token: string | null = null;
  if (match_type === "bracket") {
    const { data: tokenRow } = await sb
      .from("bracket_match_tokens")
      .select("token")
      .eq("bracket_match_id", match_id)
      .single();
    token = tokenRow?.token ?? null;
  } else {
    const { data: tokenRow } = await sb
      .from("match_tokens")
      .select("token")
      .eq("match_id", match_id)
      .single();
    token = tokenRow?.token ?? null;
  }

  if (!token) {
    return NextResponse.json({ error: "No score link found for this match. Contact an admin." }, { status: 404 });
  }

  // Return token and the redirect path so the client doesn't need to know the URL format
  const redirectPath = match_type === "bracket"
    ? `/longvolleyball/bracket-score/${token}`
    : `/longvolleyball/score/${token}`;

  return NextResponse.json({ token, redirectPath });
}
