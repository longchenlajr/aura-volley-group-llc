import { select, text, confirm, spinner, isCancel, log } from '@clack/prompts';
import type { CliContext } from '../db';
import { computePoolStandings } from '../../../src/lib/standings';
import { computeOverallStandings, getDefaultGoldCutoff } from '../../../src/lib/tournament-standings';
import { generateBracket } from '../../../src/lib/bracket-generation';
import { getMatchFormat } from '../../../src/lib/score-format';
import { generateMatchToken, tokenExpiryForTournament } from '../../../src/lib/tokens';

async function viewBrackets(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading brackets...');

  const { data: brackets } = await ctx.supabase
    .from('brackets')
    .select('id, bracket_type, points_per_set')
    .eq('tournament_id', ctx.tournamentId)
    .order('bracket_type');

  if (!brackets?.length) {
    s.stop('');
    log.warn('No brackets generated yet.');
    return;
  }

  const bracketIds = brackets.map((b) => b.id);
  const { data: bMatches } = await ctx.supabase
    .from('bracket_matches')
    .select('id, bracket_id, round_number, match_position, court_number, match_order, status, team_a_id, team_b_id')
    .in('bracket_id', bracketIds)
    .order('bracket_id')
    .order('match_order');

  const matchIds = bMatches?.map((m) => m.id) ?? [];
  const teamIds = [
    ...new Set(
      (bMatches ?? []).flatMap((m) => [m.team_a_id, m.team_b_id].filter(Boolean)),
    ),
  ] as string[];

  const [{ data: teams }, { data: sets }] = await Promise.all([
    teamIds.length
      ? ctx.supabase.from('teams').select('id, team_name').in('id', teamIds)
      : Promise.resolve({ data: [] }),
    matchIds.length
      ? ctx.supabase
          .from('bracket_match_sets')
          .select('match_id, set_number, team_a_score, team_b_score')
          .in('match_id', matchIds)
      : Promise.resolve({ data: [] }),
  ]);

  s.stop('');

  const teamMap = new Map(teams?.map((t) => [t.id, t.team_name]) ?? []);
  type BracketSet = { match_id: string; set_number: number; team_a_score: number; team_b_score: number };
  const setsMap = new Map<string, BracketSet[]>();
  for (const set of sets ?? []) {
    if (!setsMap.has(set.match_id)) setsMap.set(set.match_id, []);
    setsMap.get(set.match_id)!.push(set as BracketSet);
  }

  for (const bracket of brackets) {
    const label = bracket.bracket_type === 'gold' ? '🥇 GOLD' : '🥈 SILVER';
    const matches = (bMatches ?? [])
      .filter((m) => m.bracket_id === bracket.id)
      .sort((a, b) => a.match_order - b.match_order);

    const total = matches.length;
    const done = matches.filter((m) => m.status === 'complete').length;

    const rows = matches.map((m) => {
      const a = m.team_a_id ? (teamMap.get(m.team_a_id) ?? '?') : 'TBD';
      const b = m.team_b_id ? (teamMap.get(m.team_b_id) ?? '?') : 'TBD';
      const matchSets = setsMap.get(m.id) ?? [];
      const score =
        matchSets.length > 0 ? matchSets.map((s) => `${s.team_a_score}-${s.team_b_score}`).join(', ') : '-';
      const icon = m.status === 'complete' ? '✓' : m.status === 'in_progress' ? '▶' : '·';
      return `  ${icon} R${m.round_number}·${m.match_position}  Crt ${m.court_number}  ${a.padEnd(18).slice(0, 18)} vs ${b.padEnd(18).slice(0, 18)}  ${score}`;
    });

    log.info(`${label} Bracket — to ${bracket.points_per_set}  (${done}/${total} done)\n${rows.join('\n')}`);
  }
}

async function generateBracketsAction(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Computing standings...');

  const [{ count: existingCount }, { data: pools }, { data: allMatches }] = await Promise.all([
    ctx.supabase
      .from('brackets')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', ctx.tournamentId),
    ctx.supabase
      .from('pools')
      .select('id, pool_label, court_number, pool_teams(team_id, seed_in_pool, teams(team_name, seed, withdrawn_at))')
      .eq('tournament_id', ctx.tournamentId),
    ctx.supabase
      .from('matches')
      .select('id, pool_id, team_a_id, team_b_id, status, match_sets(set_number, team_a_score, team_b_score)')
      .eq('tournament_id', ctx.tournamentId),
  ]);

  s.stop('');

  if (!pools?.length) {
    log.error('No pools found. Complete pool play first.');
    return;
  }

  if (existingCount && existingCount > 0) {
    const overwrite = await confirm({
      message: 'Brackets already exist. Delete and regenerate?',
    });
    if (isCancel(overwrite) || !overwrite) return;
  }

  // Compute pool standings
  const poolStandings = pools.map((pool) => {
    const allPoolTeams = (pool.pool_teams as any[]).map((pt) => ({
      team_id: pt.team_id,
      team_name: (pt.teams as any).team_name,
      seed_in_pool: pt.seed_in_pool,
      overall_seed: (pt.teams as any).seed,
      withdrawn: !!(pt.teams as any).withdrawn_at,
    }));

    // Filter out withdrawn teams
    const poolTeams = allPoolTeams.filter((t) => !t.withdrawn);

    const poolMatches = (allMatches ?? [])
      .filter((m) => m.pool_id === pool.id)
      .map((m) => ({
        id: m.id,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        status: m.status,
        sets: (m.match_sets as any[]).map((s) => ({
          team_a_score: s.team_a_score,
          team_b_score: s.team_b_score,
        })),
      }));
    const format = getMatchFormat(poolTeams.length, ctx.awesomefest);
    return {
      pool_id: pool.id,
      pool_label: pool.pool_label,
      court_number: pool.court_number,
      standings: computePoolStandings(poolTeams, poolMatches, format),
    };
  });

  const overallStandings = computeOverallStandings(poolStandings);
  const defaultCutoff = ctx.awesomefest ? overallStandings.length : getDefaultGoldCutoff(overallStandings, pools.length);

  // Show standings preview
  const preview = overallStandings
    .map(
      (t, i) =>
        `  ${String(i + 1).padStart(2)}. ${t.team_name.padEnd(24).slice(0, 24)}  Pool ${t.pool_label}  (${t.matches_won}W-${t.matches_lost}L)`,
    )
    .join('\n');
  log.info(`Overall Standings (${overallStandings.length} teams):\n${preview}`);

  // Prompts
  let goldCutoff: number;
  let pointsPerSet: 11 | 15 | 21;

  if (ctx.awesomefest) {
    goldCutoff = overallStandings.length;
    pointsPerSet = 21;
    log.info('AwesomeFest tournament — games to 21, single bracket (everyone makes playoffs).');
  } else {
    const cutoffInput = await text({
      message: `Gold bracket size — top N teams (default ${defaultCutoff}):`,
      placeholder: String(defaultCutoff),
      validate: (v) => {
        const n = parseInt(v || String(defaultCutoff));
        if (isNaN(n) || n < 2 || n > overallStandings.length - 1)
          return `Enter 2–${overallStandings.length - 1}`;
      },
    });
    if (isCancel(cutoffInput)) return;
    goldCutoff = parseInt((cutoffInput as string) || String(defaultCutoff)) || defaultCutoff;

    const ptsChoice = await select({
      message: 'Points per set for playoffs:',
      options: [
        { value: '15', label: '15 points' },
        { value: '11', label: '11 points' },
      ],
    });
    if (isCancel(ptsChoice)) return;
    pointsPerSet = parseInt(ptsChoice as string) as 11 | 15;
  }

  const goldCourtsInput = await text({
    message: 'Gold bracket courts (comma-separated, e.g. 1,2):',
    placeholder: '1,2',
    validate: (v) => (!v?.trim() ? 'Enter at least one court' : undefined),
  });
  if (isCancel(goldCourtsInput)) return;
  const goldCourts = (goldCourtsInput as string)
    .split(',')
    .map((c) => parseInt(c.trim()))
    .filter((n) => !isNaN(n));

  const silverTeams = overallStandings.slice(goldCutoff);
  let silverCourts: number[] = [];

  if (silverTeams.length >= 2) {
    const silverCourtsInput = await text({
      message: 'Silver bracket courts (comma-separated, e.g. 3,4):',
      placeholder: '3,4',
      validate: (v) => (!v?.trim() ? 'Enter at least one court' : undefined),
    });
    if (isCancel(silverCourtsInput)) return;
    silverCourts = (silverCourtsInput as string)
      .split(',')
      .map((c) => parseInt(c.trim()))
      .filter((n) => !isNaN(n));
  }

  const confirmed = await confirm({
    message: `Generate Gold (${goldCutoff} teams) + Silver (${silverTeams.length} teams)?`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s2 = spinner();
  s2.start('Generating brackets...');

  await ctx.supabase.from('brackets').delete().eq('tournament_id', ctx.tournamentId);

  const expiresAt = tokenExpiryForTournament(ctx.tournamentDate).toISOString();

  async function insertBracket(
    teams: typeof overallStandings,
    bracketType: 'gold' | 'silver',
    courts: number[],
    matchOrderOffset: number,
  ): Promise<number> {
    const generated = generateBracket(teams, bracketType, pointsPerSet, courts, matchOrderOffset);

    const { data: bracketRecord } = await ctx.supabase
      .from('brackets')
      .insert({ tournament_id: ctx.tournamentId, bracket_type: bracketType, points_per_set: pointsPerSet })
      .select()
      .single();

    if (!bracketRecord) return 0;

    await ctx.supabase.from('bracket_slots').insert(
      generated.slots.map((sl) => ({
        bracket_id: bracketRecord.id,
        round_number: sl.round_number,
        slot_position: sl.slot_position,
        team_id: sl.team_id,
        is_bye: sl.is_bye,
      })),
    );

    const { data: insertedSlots } = await ctx.supabase
      .from('bracket_slots')
      .select('id, round_number, slot_position')
      .eq('bracket_id', bracketRecord.id);

    const slotMap = new Map(
      (insertedSlots ?? []).map((sl) => [`${sl.round_number}:${sl.slot_position}`, sl.id]),
    );

    const totalRounds = generated.slots.length > 0
      ? Math.max(...generated.slots.map((sl) => sl.round_number))
      : 0;

    for (const gm of generated.matches) {
      const slotAId = slotMap.get(`${gm.round_number}:${gm.slot_a_position}`);
      const slotBId = slotMap.get(`${gm.round_number}:${gm.slot_b_position}`);
      const winnerRound = gm.round_number + 1;
      const winnerSlotId =
        winnerRound <= totalRounds
          ? slotMap.get(`${winnerRound}:${gm.match_position}`)
          : null;

      const { data: match } = await ctx.supabase
        .from('bracket_matches')
        .insert({
          bracket_id: bracketRecord.id,
          round_number: gm.round_number,
          match_position: gm.match_position,
          slot_a_id: slotAId ?? null,
          slot_b_id: slotBId ?? null,
          winner_slot_id: winnerSlotId ?? null,
          team_a_id: gm.team_a_id,
          team_b_id: gm.team_b_id,
          work_team_id: gm.work_team_id,
          court_number: gm.court_number,
          match_order: gm.match_order,
          status: 'scheduled',
        })
        .select('id')
        .single();

      if (match) {
        await ctx.supabase.from('bracket_match_tokens').insert({
          match_id: match.id,
          token: generateMatchToken(),
          expires_at: expiresAt,
        });
      }
    }

    return generated.matches.length;
  }

  const goldTeams = overallStandings.slice(0, goldCutoff);
  const goldMatchCount = await insertBracket(goldTeams, 'gold', goldCourts, 0);

  let silverMatchCount = 0;
  if (silverTeams.length >= 2) {
    silverMatchCount = await insertBracket(silverTeams, 'silver', silverCourts, goldMatchCount);
  }

  s2.stop(
    `Gold bracket: ${goldMatchCount} match(es). Silver bracket: ${silverMatchCount} match(es).`,
  );
}

async function resetBrackets(ctx: CliContext): Promise<void> {
  const confirmed = await confirm({ message: 'Delete ALL brackets?' });
  if (isCancel(confirmed) || !confirmed) return;

  const s = spinner();
  s.start('Deleting brackets...');
  await ctx.supabase.from('brackets').delete().eq('tournament_id', ctx.tournamentId);
  s.stop('Brackets deleted.');
}

export async function bracketsMenu(ctx: CliContext): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Bracket Management',
      options: [
        { value: 'view', label: 'View brackets' },
        { value: 'generate', label: 'Generate brackets' },
        { value: 'reset', label: 'Reset brackets' },
        { value: 'back', label: '← Back' },
      ],
    });

    if (isCancel(action) || action === 'back') return;

    switch (action) {
      case 'view':
        await viewBrackets(ctx);
        break;
      case 'generate':
        await generateBracketsAction(ctx);
        break;
      case 'reset':
        await resetBrackets(ctx);
        break;
    }
  }
}
