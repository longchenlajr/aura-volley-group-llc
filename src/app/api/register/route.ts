import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getTournaments, getTournament } from "@/lib/tournaments";

// GET: return open tournaments
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const check = searchParams.get("check");

  if (check === "tournaments") {
    const tournaments = getTournaments().filter((t) => t.registrationOpen);
    return NextResponse.json({ tournaments });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// POST: register a new team
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tournamentId, teamName, contactPhone, players } = body as {
    tournamentId: string;
    teamName: string;
    contactPhone: string;
    players: { name: string; email: string }[];
  };

  // Validate tournament exists and is open
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

  // Validate player count matches teamSize
  if (!players || players.length !== tournament.teamSize) {
    return NextResponse.json(
      { error: `This tournament requires exactly ${tournament.teamSize} players.` },
      { status: 400 },
    );
  }

  // Validate captain (first player) has email
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

  // Insert team
  const { data: team, error: teamError } = await getSupabase()
    .from("teams")
    .insert({
      tournament_id: tournamentId,
      team_name: teamName,
      contact_email: players[0].email,
      contact_phone: contactPhone,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    console.error("Supabase team insert error:", teamError);
    return NextResponse.json(
      { error: "Failed to create team.", detail: teamError?.message },
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

  return NextResponse.json({ ok: true, teamId: team.id });
}
