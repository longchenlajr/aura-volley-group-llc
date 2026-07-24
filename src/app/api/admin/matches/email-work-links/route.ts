import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTournament } from "@/lib/tournaments";
import { getMatchFormat, formatMatchFormat } from "@/lib/score-format";
import { Resend } from "resend";

// POST /api/admin/matches/email-work-links — send work assignment emails
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tournament_id } = body as { tournament_id: string };
  if (!tournament_id) return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });

  const tournament = getTournament(tournament_id);
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  const sb = getSupabaseAdmin();

  // Get all matches with tokens, team data, and pool data
  const { data: matches } = await sb
    .from("matches")
    .select(`
      id, match_order, court_number, work_team_id,
      team_a:teams!matches_team_a_id_fkey(team_name),
      team_b:teams!matches_team_b_id_fkey(team_name),
      work_team:teams!matches_work_team_id_fkey(team_name, contact_email, withdrawn_at),
      pool:pools!matches_pool_id_fkey(pool_label, court_number)
    `)
    .eq("tournament_id", tournament_id)
    .not("work_team_id", "is", null)
    .order("match_order");

  if (!matches?.length) {
    return NextResponse.json({ error: "No matches with work assignments found" }, { status: 400 });
  }

  // Get tokens
  const matchIds = matches.map((m) => m.id);
  const { data: tokens } = await sb
    .from("match_tokens")
    .select("match_id, token")
    .in("match_id", matchIds);

  const tokenMap = new Map((tokens ?? []).map((t) => [t.match_id, t.token]));

  // Get pool team counts for format
  const poolIds = [...new Set(matches.map((m) => (m.pool as unknown as { pool_label: string })?.pool_label).filter(Boolean))];
  // Simplified: get any pool's team count
  const { data: poolTeamCounts } = await sb
    .from("pools")
    .select("id, pool_label")
    .eq("tournament_id", tournament_id);

  const poolTeamCountMap = new Map<string, number>();
  if (poolTeamCounts) {
    for (const p of poolTeamCounts) {
      const { count } = await sb
        .from("pool_teams")
        .select("*", { count: "exact", head: true })
        .eq("pool_id", p.id);
      poolTeamCountMap.set(p.pool_label, count ?? 4);
    }
  }

  // Group matches by work team
  const byWorkTeam = new Map<string, typeof matches>();
  for (const m of matches) {
    const wtId = m.work_team_id!;
    if (!byWorkTeam.has(wtId)) byWorkTeam.set(wtId, []);
    byWorkTeam.get(wtId)!.push(m);
  }

  const tournamentDate = new Date(tournament.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  let skippedWithdrawn = 0;

  for (const [, teamMatches] of byWorkTeam) {
    const workTeam = teamMatches[0].work_team as unknown as { team_name: string; contact_email: string; withdrawn_at: string | null };
    if (!workTeam?.contact_email) continue;

    // Skip withdrawn teams — log and count separately
    if (workTeam.withdrawn_at) {
      console.log(`[RESEND] Skipping withdrawn work team: ${workTeam.team_name} (${workTeam.contact_email})`);
      skippedWithdrawn++;
      continue;
    }

    const matchListHtml = teamMatches.map((m) => {
      const poolLabel = (m.pool as unknown as { pool_label: string })?.pool_label ?? "";
      const poolSize = poolTeamCountMap.get(poolLabel) ?? 4;
      const format = getMatchFormat(poolSize, tournament.awesomefest);
      const teamA = (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD";
      const teamB = (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD";
      const token = tokenMap.get(m.id) ?? "";
      const scoreUrl = `https://longvolleyball.com/longvolleyball/score/${token}`;

      return `
      <div style="background:#FFF8E7;border:1px solid rgba(122,28,28,0.18);border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#9B6B1E;margin:0 0 6px;">Pool ${poolLabel} · Court ${m.court_number} · Match ${m.match_order}</p>
        <p style="font-size:15px;color:#2A1810;margin:0 0 4px;font-weight:600;">${teamA} vs ${teamB}</p>
        <p style="font-size:12px;color:#6B4E3D;margin:0 0 8px;">${formatMatchFormat(format)}</p>
        <a href="${scoreUrl}" style="display:inline-block;background:#7A1C1C;color:#F5E6C8;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;">Submit score</a>
      </div>`;
    }).join("");

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5E6C8;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:24px;color:#7A1C1C;margin:0 0 8px;">Your match work assignments</h1>
  <p style="font-size:14px;color:#6B4E3D;margin:0 0 24px;">${tournament.name} · ${tournamentDate}</p>
  <p style="font-size:14px;color:#2A1810;margin:0 0 16px;">Hey ${workTeam.team_name} — you're assigned to work the following matches. Use the links below to submit scores after each match.</p>
  ${matchListHtml}
  <p style="font-size:13px;color:#6B4E3D;line-height:1.6;margin:24px 0 0;">These links only work on tournament day. After each match, tap the link and enter the final score. You have 10 minutes to edit after submitting.</p>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(122,28,28,0.12);text-align:center;">
    <p style="font-size:12px;color:#9B6B1E;margin:0;">The Long Family · longvolleyball.com</p>
  </div>
</div></body></html>`.trim();

    const text = `Your match work assignments\n${tournament.name} · ${tournamentDate}\n\n${teamMatches.map((m) => {
      const poolLabel = (m.pool as unknown as { pool_label: string })?.pool_label ?? "";
      const teamA = (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD";
      const teamB = (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD";
      const token = tokenMap.get(m.id) ?? "";
      return `Pool ${poolLabel} Court ${m.court_number} Match ${m.match_order}: ${teamA} vs ${teamB}\nScore link: https://longvolleyball.com/longvolleyball/score/${token}`;
    }).join("\n\n")}\n\nThese links only work on tournament day.`;

    try {
      await resend.emails.send({
        from: "Long Volleyball <info@longvolleyball.com>",
        replyTo: "info@longvolleyball.com",
        to: workTeam.contact_email,
        subject: `Your match work assignments — ${tournament.name}, ${tournamentDate}`,
        html,
        text,
      });
      sent++;
    } catch (err) {
      console.error(`[RESEND] Failed to send work links to ${workTeam.contact_email}:`, err);
      failed++;
    }
  }

  // Also send bracket match work links
  const { data: bracketMatches } = await sb
    .from("bracket_matches")
    .select(`
      id, match_order, court_number, round_number, work_team_id,
      team_a:teams!bracket_matches_team_a_id_fkey(team_name),
      team_b:teams!bracket_matches_team_b_id_fkey(team_name),
      work_team:teams!bracket_matches_work_team_id_fkey(team_name, contact_email, withdrawn_at),
      bracket:brackets!bracket_matches_bracket_id_fkey(bracket_type, tournament_id)
    `)
    .not("work_team_id", "is", null);

  const bracketMatchesForTournament = (bracketMatches ?? []).filter(
    (m) => (m.bracket as unknown as { tournament_id: string })?.tournament_id === tournament_id,
  );

  if (bracketMatchesForTournament.length > 0) {
    const bmIds = bracketMatchesForTournament.map((m) => m.id);
    const { data: bmTokens } = await sb.from("bracket_match_tokens").select("bracket_match_id, token").in("bracket_match_id", bmIds);
    const bmTokenMap = new Map((bmTokens ?? []).map((t) => [t.bracket_match_id, t.token]));

    const byWorkTeam = new Map<string, typeof bracketMatchesForTournament>();
    for (const m of bracketMatchesForTournament) {
      const wtId = m.work_team_id!;
      if (!byWorkTeam.has(wtId)) byWorkTeam.set(wtId, []);
      byWorkTeam.get(wtId)!.push(m);
    }

    for (const [, teamBracketMatches] of byWorkTeam) {
      const wt = teamBracketMatches[0].work_team as unknown as { team_name: string; contact_email: string; withdrawn_at: string | null };
      if (!wt?.contact_email) continue;

      if (wt.withdrawn_at) {
        console.log(`[RESEND] Skipping withdrawn bracket work team: ${wt.team_name} (${wt.contact_email})`);
        skippedWithdrawn++;
        continue;
      }

      const matchListHtml = teamBracketMatches.map((m) => {
        const bracketType = (m.bracket as unknown as { bracket_type: string })?.bracket_type ?? "gold";
        const teamA = (m.team_a as unknown as { team_name: string })?.team_name ?? "TBD";
        const teamB = (m.team_b as unknown as { team_name: string })?.team_name ?? "TBD";
        const token = bmTokenMap.get(m.id) ?? "";
        return `<div style="background:#FFF8E7;border:1px solid rgba(122,28,28,0.18);border-radius:8px;padding:16px;margin-bottom:12px;">
          <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#9B6B1E;margin:0 0 6px;">${bracketType === "gold" ? "Gold" : "Silver"} Bracket · Court ${m.court_number}</p>
          <p style="font-size:15px;color:#2A1810;margin:0 0 8px;font-weight:600;">${teamA} vs ${teamB}</p>
          <a href="https://longvolleyball.com/longvolleyball/bracket-score/${token}" style="display:inline-block;background:#7A1C1C;color:#F5E6C8;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;">Submit score</a>
        </div>`;
      }).join("");

      try {
        await resend.emails.send({
          from: "Long Volleyball <info@longvolleyball.com>",
          replyTo: "info@longvolleyball.com",
          to: wt.contact_email,
          subject: `Your playoff work assignments — ${tournament.name}, ${tournamentDate}`,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F5E6C8;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><h1 style="font-size:24px;color:#7A1C1C;margin:0 0 24px;">Your playoff work assignments</h1>${matchListHtml}<div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(122,28,28,0.12);text-align:center;"><p style="font-size:12px;color:#9B6B1E;margin:0;">The Long Family · longvolleyball.com</p></div></div></body></html>`,
          text: `Playoff work assignments\n\n${teamBracketMatches.map((m) => { const t = bmTokenMap.get(m.id) ?? ""; return `Court ${m.court_number}: ${(m.team_a as unknown as { team_name: string })?.team_name} vs ${(m.team_b as unknown as { team_name: string })?.team_name}\nhttps://longvolleyball.com/longvolleyball/bracket-score/${t}`; }).join("\n\n")}`,
        });
        sent++;
      } catch (err) {
        console.error(`[RESEND] Failed to send bracket work links to ${wt.contact_email}:`, err);
        failed++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skippedWithdrawn });
}
