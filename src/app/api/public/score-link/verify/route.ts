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
  const emailLower = email.toLowerCase().trim();

  // Look up the match and its tournament_id
  let tournamentId: string | null = null;
  let teamAId: string | null = null;
  let teamBId: string | null = null;

  if (match_type === "bracket") {
    const { data: match } = await sb
      .from("bracket_matches")
      .select("id, team_a_id, team_b_id, bracket:brackets!bracket_matches_bracket_id_fkey(tournament_id)")
      .eq("id", match_id)
      .single();
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    tournamentId = (match.bracket as unknown as { tournament_id: string })?.tournament_id ?? null;
    teamAId = match.team_a_id;
    teamBId = match.team_b_id;
  } else {
    const { data: match } = await sb
      .from("matches")
      .select("id, tournament_id, team_a_id, team_b_id")
      .eq("id", match_id)
      .single();
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    tournamentId = match.tournament_id;
    teamAId = match.team_a_id;
    teamBId = match.team_b_id;
  }

  if (!tournamentId) {
    return NextResponse.json({ error: "Could not determine tournament." }, { status: 500 });
  }

  // Find the team this email belongs to among ALL teams in the tournament
  const { data: teams } = await sb
    .from("teams")
    .select("id, team_name, contact_email")
    .eq("tournament_id", tournamentId);

  const teamIds = (teams ?? []).map((t) => t.id);

  let matchedTeamId: string | null = null;
  let matchedTeamName: string | null = null;

  // Check contact_email on each team first (fast path)
  for (const team of teams ?? []) {
    if (team.contact_email && team.contact_email.toLowerCase().trim() === emailLower) {
      matchedTeamId = team.id;
      matchedTeamName = team.team_name;
      break;
    }
  }

  // If no contact_email match, check player emails across all tournament teams
  if (!matchedTeamId && teamIds.length > 0) {
    const { data: players } = await sb
      .from("players")
      .select("email, team_id")
      .in("team_id", teamIds);

    const matchedPlayer = (players ?? []).find(
      (p) => p.email && p.email.toLowerCase().trim() === emailLower,
    );

    if (matchedPlayer) {
      const team = (teams ?? []).find((t) => t.id === matchedPlayer.team_id);
      if (team) {
        matchedTeamId = team.id;
        matchedTeamName = team.team_name;
      }
    }
  }

  if (!matchedTeamId) {
    return NextResponse.json(
      { error: "That email doesn't match any registered team. Please check with an admin." },
      { status: 403 },
    );
  }

  // Update the work_team_id to the team that's actually working this match.
  // For pool matches, the DB constraint prevents a playing team from being the work team,
  // so skip the update if the matched team is already playing in this match.
  const isPlayingTeam = matchedTeamId === teamAId || matchedTeamId === teamBId;

  if (!isPlayingTeam) {
    const table = match_type === "bracket" ? "bracket_matches" : "matches";
    await sb.from(table).update({ work_team_id: matchedTeamId }).eq("id", match_id);
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

  // Return token, redirect path, and the matched team name
  const redirectPath = match_type === "bracket"
    ? `/longvolleyball/bracket-score/${token}`
    : `/longvolleyball/score/${token}`;

  return NextResponse.json({ token, redirectPath, team_name: matchedTeamName });
}
