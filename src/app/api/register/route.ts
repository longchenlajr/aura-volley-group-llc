import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUpcomingTournaments, getTournament } from "@/lib/tournaments";
import { auth } from "@/auth";
import { Resend } from "resend";

// --- Rate limiter (in-memory, per IP, 5 requests / 10 min) ---
const RATE_LIMIT = 5;
const RATE_WINDOW = 10 * 60 * 1000; // 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// --- Phone validation ---
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// GET: return open upcoming tournaments
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const check = searchParams.get("check");

  if (check === "tournaments") {
    const tournaments = getUpcomingTournaments().filter((t) => t.registrationOpen);
    return NextResponse.json({ tournaments });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// POST: register a new team
export async function POST(req: NextRequest) {
  // Rate limit check — skip for authenticated admins
  const session = await auth();
  if (!session) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again in a few minutes." },
        { status: 429 },
      );
    }
  }

  const body = await req.json();
  const { tournamentId, teamName, contactPhone, players } = body as {
    tournamentId: string;
    teamName: string;
    contactPhone: string;
    players: { name: string; email: string }[];
  };

  // Validate tournament exists, is open, and hasn't passed
  const tournament = getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json(
      { error: "Tournament not found." },
      { status: 404 },
    );
  }
  if (!tournament.registrationOpen) {
    return NextResponse.json(
      { error: "Registration is closed for this tournament." },
      { status: 400 },
    );
  }
  if (new Date(tournament.date) < new Date()) {
    return NextResponse.json(
      { error: "This tournament has already passed." },
      { status: 400 },
    );
  }

  // Validate player count matches teamSize
  if (!players || players.length !== tournament.teamSize) {
    return NextResponse.json(
      { error: `This tournament requires exactly ${tournament.teamSize} players.` },
      { status: 400 },
    );
  }

  // Validate captain (first player) has name and email
  if (!players[0]?.name || !players[0]?.email) {
    return NextResponse.json(
      { error: "Captain name and email are required." },
      { status: 400 },
    );
  }

  if (!teamName || !contactPhone) {
    return NextResponse.json(
      { error: "Team name and contact phone are required." },
      { status: 400 },
    );
  }

  // Validate and normalize phone
  const phone = normalizePhone(contactPhone);
  if (!phone) {
    return NextResponse.json(
      { error: "Phone must be a valid 10-digit US number." },
      { status: 400 },
    );
  }

  // Insert team
  const { data: team, error: teamError } = await getSupabase()
    .from("teams")
    .insert({
      tournament_id: tournamentId,
      team_name: teamName,
      contact_email: players[0].email,
      contact_phone: phone,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    // Check for unique constraint violation (duplicate team name)
    if (teamError?.code === "23505") {
      return NextResponse.json(
        { error: "A team with that name is already registered for this tournament. Please choose a different team name." },
        { status: 409 },
      );
    }
    console.error("Supabase team insert error:", teamError);
    return NextResponse.json(
      { error: "Failed to create team." },
      { status: 500 },
    );
  }

  // Insert players
  const playerRows = players.map((p, idx) => ({
    team_id: team.id,
    name: p.name,
    email: p.email || null,
    is_captain: idx === 0,
  }));

  const { error: playersError } = await getSupabase()
    .from("players")
    .insert(playerRows);

  if (playersError) {
    return NextResponse.json(
      { error: "Team created but failed to add players." },
      { status: 500 },
    );
  }

  // --- Send confirmation email (non-blocking) ---
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const tournamentDate = new Date(tournament.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const playerListHtml = players
      .map((p, i) => `<tr><td style="padding:6px 0;color:#2A1810;font-size:15px;">${p.name}${i === 0 ? " (Captain)" : ""}</td><td style="padding:6px 0;color:#6B4E3D;font-size:14px;text-align:right;">${p.email || "—"}</td></tr>`)
      .join("");

    const playerListText = players
      .map((p, i) => `  ${p.name}${i === 0 ? " (Captain)" : ""} — ${p.email || "no email"}`)
      .join("\n");

    const total = tournament.teamSize * 25;
    const labelStyle = "padding:4px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#9B6B1E;";
    const valueStyle = "padding:4px 0;font-size:15px;color:#2A1810;text-align:right;";
    const sectionTitle = "font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#9B6B1E;margin:0 0 8px;";
    const bodyText = "font-size:13px;color:#2A1810;line-height:1.7;margin:0 0 4px;";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5E6C8;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:28px;color:#7A1C1C;margin:0 0 8px;">You're registered.</h1>
      <p style="font-size:14px;color:#6B4E3D;margin:0;">Confirmation for ${teamName}</p>
    </div>

    <div style="background:#FFF8E7;border:1px solid rgba(122,28,28,0.18);border-radius:8px;padding:24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${labelStyle}">Tournament</td><td style="${valueStyle}">${tournament.name}</td></tr>
        <tr><td style="${labelStyle}">Date</td><td style="${valueStyle}">${tournamentDate}</td></tr>
        <tr><td style="${labelStyle}">Location</td><td style="${valueStyle}">${tournament.location}</td></tr>
        <tr><td style="${labelStyle}">Team</td><td style="${valueStyle}">${teamName}</td></tr>
      </table>
    </div>

    <div style="margin-bottom:24px;">
      <p style="${sectionTitle}">Roster</p>
      <table style="width:100%;border-collapse:collapse;">
        ${playerListHtml}
      </table>
    </div>

    <div style="background:#FFF8E7;border:1px solid rgba(122,28,28,0.18);border-radius:8px;padding:16px;text-align:center;margin-bottom:32px;">
      <p style="font-size:13px;color:#7A1C1C;font-weight:bold;margin:0 0 4px;">$${total} due at check-in</p>
      <p style="font-size:12px;color:#6B4E3D;margin:0;">$25 per player &middot; Cash only</p>
    </div>

    <div style="border-top:1px solid rgba(122,28,28,0.12);margin:32px 0;"></div>

    <div style="margin-bottom:28px;">
      <p style="${sectionTitle}">Check-in</p>
      <p style="${bodyText}">Registration opens at <strong>9:00 AM</strong>. Games begin at <strong>10:00 AM</strong>. Please arrive on time &mdash; late teams may forfeit their first match.</p>
    </div>

    <div style="margin-bottom:28px;">
      <p style="${sectionTitle}">What to bring</p>
      <p style="${bodyText}">Food, water, and sunscreen. Snacks will be available for purchase on-site.</p>
      <p style="${bodyText}">There are no on-site restrooms. The nearest restroom is at <strong>Wawa</strong>, 1.3 miles away at 408 S. Cedar Crest Blvd.</p>
    </div>

    <div style="margin-bottom:28px;">
      <p style="${sectionTitle}">Code of conduct</p>
      <p style="${bodyText}">This is a family-friendly event. Please be respectful of all players, spectators, and neighbors. Refrain from foul language. Unsportsmanlike behavior may result in removal from the tournament.</p>
    </div>

    <div style="margin-bottom:28px;">
      <p style="${sectionTitle}">Questions?</p>
      <p style="${bodyText}">DM us on Instagram <a href="https://instagram.com/long_volleyball" style="color:#7A1C1C;text-decoration:underline;">@long_volleyball</a> for any questions or concerns leading up to the tournament.</p>
    </div>

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid rgba(122,28,28,0.12);text-align:center;">
      <p style="font-size:12px;color:#6B4E3D;margin:0 0 8px;">
        <a href="https://instagram.com/long_volleyball" style="color:#7A1C1C;text-decoration:none;">Instagram</a>
        &nbsp;&middot;&nbsp;
        <a href="https://longvolleyball.com" style="color:#7A1C1C;text-decoration:none;">longvolleyball.com</a>
      </p>
      <p style="font-size:13px;color:#2A1810;margin:0;">Thank You <span style="color:#7A1C1C;">&hearts;</span> The Long's</p>
    </div>
  </div>
</body>
</html>`.trim();

    const text = `You're registered!

Team: ${teamName}
Tournament: ${tournament.name}
Date: ${tournamentDate}
Location: ${tournament.location}

Roster:
${playerListText}

$${total} due at check-in ($25 per player, cash only).

---

TOURNAMENT DAY INFO

CHECK-IN
Registration opens at 9:00 AM. Games begin at 10:00 AM.
Please arrive on time — late teams may forfeit their first match.

WHAT TO BRING
Food, water, and sunscreen. Snacks will be available for
purchase on-site. There are no on-site restrooms. The nearest
restroom is at Wawa, 1.3 miles away at 408 S. Cedar Crest Blvd.

CODE OF CONDUCT
This is a family-friendly event. Please be respectful of all
players, spectators, and neighbors. Refrain from foul language.
Unsportsmanlike behavior may result in removal from the tournament.

QUESTIONS?
DM us on Instagram @long_volleyball for any questions or concerns
leading up to the tournament.

---

Instagram: instagram.com/long_volleyball
Web: longvolleyball.com
Thank You <3 The Long's`;

    const fromAddress = "Long Volleyball Registration <registration@longvolleyball.com>";
    await resend.emails.send({
      from: fromAddress,
      replyTo: "info@longvolleyball.com",
      to: players[0].email,
      cc: players.slice(1).map((p) => p.email).filter(Boolean) as string[],
      bcc: "info@longvolleyball.com",
      subject: `You're registered — ${tournament.name}, ${tournamentDate}`,
      html,
      text,
    });
  } catch (err) {
    console.error("[RESEND] Failed to send from registration@longvolleyball.com:", err);
  }

  return NextResponse.json({ ok: true, teamId: team.id });
}
