import { select, text, confirm, spinner, isCancel, log } from '@clack/prompts';
import type { CliContext } from '../db';
import { generatePools } from '../../../src/lib/pool-generation';
import { generatePoolMatches } from '../../../src/lib/match-generation';
import { computePoolStandings } from '../../../src/lib/standings';
import { computeOverallStandings, getDefaultGoldCutoff } from '../../../src/lib/tournament-standings';
import { generateBracket, countR1Games } from '../../../src/lib/bracket-generation';
import { getMatchFormat } from '../../../src/lib/score-format';
import { generateMatchToken, tokenExpiryForTournament } from '../../../src/lib/tokens';

// ─── Name pools ─────────────────────────────────────────────────────────────

const TEAM_NAMES = [
  'Wrecking Crew', 'Net Gain', 'Block Party', 'Set to Kill', 'Spike Force',
  'Sand Storm', 'Ace Ventura', 'Ball Busters', 'Dig Deep', 'Smash Bros',
  'Court Jesters', 'Top Spin', 'Side Out', 'Net Result', 'Power Surge',
  'Full Send', 'Air Raid', 'Kill Shot', 'Bump Set', 'No Mercy',
  'Hang Time', 'Volley Llamas', 'Ace Holes', 'Pancake City', 'Sky Hooks',
  'Tip Top', 'Ground Zero', 'Snap Attack', 'Pass Kings', 'Dig It',
  'Rally Caps', 'Crossfire', 'High Heat', 'Rip Tide', 'Line Drive',
  'Drop Shot', 'Thunder Cats', 'Fast Break', 'Iron Fist', 'Wild Card',
];

const FIRST = [
  'Jake','Mia','Chris','Jordan','Marcus','Tessa','Alex','Kai','Leo','Eli',
  'Owen','Nate','Caleb','Damon','Theo','Finn','Liam','Ryder','Gavin','Miles',
  'Tyler','Aiden','Sam','Casey','Devon','Ryan','Brooke','Reese','Dana','Jada',
];

const LAST = [
  'Martinez','Chen','Delvalle','Price','Hall','Quinn','Kim','Johnson','Fernandez','Stone',
  'Marks','Russo','Tran','Vega','Grant','OBrien','Cho','Fox','Reese','Torres',
  'Brooks','Walsh','Nguyen','Rivera','Lee','Patel','Turner','Morgan','Cross','Wright',
];

function fakeName(offset: number): string {
  return `${FIRST[offset % FIRST.length]} ${LAST[offset % LAST.length]}`;
}

function fakePhone(): string {
  const n = () => String(Math.floor(Math.random() * 900) + 100);
  return `(${n()}) ${n()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

// ─── Score simulation ────────────────────────────────────────────────────────

function simulateSet(pointsPerSet: number, pointsCap?: number): [number, number] {
  const aWins = Math.random() > 0.5;
  const deuce = pointsCap != null && Math.random() < 0.15;
  const win = deuce ? pointsCap! : pointsPerSet;
  const lose = deuce ? pointsCap! - 1 : Math.floor(Math.random() * (pointsPerSet - 1));
  return aWins ? [win, lose] : [lose, win];
}

// ─── Clean ───────────────────────────────────────────────────────────────────

async function cleanTournament(ctx: CliContext): Promise<void> {
  // Delete in FK dependency order; cascades handle child rows
  await ctx.supabase.from('brackets').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('matches').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('pools').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('teams').delete().eq('tournament_id', ctx.tournamentId);
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function doSeedTeams(ctx: CliContext, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const teamName = i < TEAM_NAMES.length ? TEAM_NAMES[i] : `Team ${i + 1}`;
    const captainName = fakeName(i);
    const captainEmail = `cap${i + 1}.${captainName.toLowerCase().replace(/ /g, '.')}@test.dev`;

    const { data: rows, error } = await ctx.supabase
      .from('teams')
      .insert({
        tournament_id: ctx.tournamentId,
        team_name: teamName,
        contact_email: captainEmail,
        contact_phone: fakePhone(),
        seed: i + 1,
        checked_in: true,
      })
      .select('id');

    const team = rows?.[0];
    if (error || !team) {
      log.warn(`Skipped "${teamName}": ${error?.message ?? 'unknown'}`);
      continue;
    }

    const players = Array.from({ length: ctx.teamSize }, (_, pi) => ({
      team_id: team.id,
      name: pi === 0 ? captainName : fakeName(i * ctx.teamSize + pi + 7),
      email: `team${i + 1}.p${pi + 1}@test.dev`,
      is_captain: pi === 0,
    }));

    await ctx.supabase.from('players').insert(players);
  }
}

async function seedTeamsAction(ctx: CliContext): Promise<void> {
  const countInput = await text({
    message: 'Number of teams to seed:',
    placeholder: '8',
    validate: (v) => { const n = parseInt(v ?? ''); if (isNaN(n) || n < 2) return 'Enter at least 2'; },
  });
  if (isCancel(countInput)) return;
  const count = parseInt(countInput as string);

  const doClean = await confirm({ message: 'Wipe existing tournament data first?' });
  if (isCancel(doClean)) return;

  const s = spinner();
  s.start(doClean ? 'Cleaning...' : 'Seeding...');

  if (doClean) await cleanTournament(ctx);

  s.message(`Seeding ${count} teams...`);
  await doSeedTeams(ctx, count);
  s.stop(`${count} teams seeded and checked in.`);
}

// ─── Simulate pool play ───────────────────────────────────────────────────────

async function simulatePoolPlayAction(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading incomplete matches...');

  const { data: matches } = await ctx.supabase
    .from('matches')
    .select('id, pool_id, status')
    .eq('tournament_id', ctx.tournamentId)
    .neq('status', 'complete');

  if (!matches?.length) {
    s.stop('');
    log.warn('No incomplete pool matches. Generate matches first.');
    return;
  }

  const poolIds = [...new Set(matches.map((m) => m.pool_id))];
  const { data: poolTeams } = await ctx.supabase
    .from('pool_teams')
    .select('pool_id')
    .in('pool_id', poolIds);

  s.stop('');

  const poolSizeMap = new Map<string, number>();
  for (const pt of poolTeams ?? []) {
    poolSizeMap.set(pt.pool_id, (poolSizeMap.get(pt.pool_id) ?? 0) + 1);
  }

  const confirmed = await confirm({
    message: `Fill scores for ${matches.length} incomplete match(es)?`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s2 = spinner();
  s2.start('Simulating...');

  for (const match of matches) {
    const format = getMatchFormat(poolSizeMap.get(match.pool_id) ?? 4, ctx.awesomefest);

    await ctx.supabase.from('match_sets').delete().eq('match_id', match.id);

    const sets = Array.from({ length: format.sets }, (_, i) => {
      const [a, b] = simulateSet(format.pointsPerSet, format.pointsCap);
      return { match_id: match.id, set_number: i + 1, team_a_score: a, team_b_score: b, submitted_by: 'sim' };
    });

    await ctx.supabase.from('match_sets').insert(sets);
    await ctx.supabase
      .from('matches')
      .update({ status: 'complete', end_time: new Date().toISOString() })
      .eq('id', match.id);
  }

  s2.stop(`${matches.length} match(es) simulated.`);
}

// ─── Simulate bracket play ────────────────────────────────────────────────────

async function simulateBracketPlayAction(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading brackets...');

  const { data: brackets } = await ctx.supabase
    .from('brackets')
    .select('id, bracket_type, points_per_set')
    .eq('tournament_id', ctx.tournamentId);

  if (!brackets?.length) {
    s.stop('');
    log.warn('No brackets found. Generate brackets first.');
    return;
  }

  const bracketIds = brackets.map((b) => b.id);
  const { data: allMatches } = await ctx.supabase
    .from('bracket_matches')
    .select('id, round_number, team_a_id, team_b_id, status')
    .in('bracket_id', bracketIds)
    .order('round_number');

  s.stop('');

  const incomplete = (allMatches ?? []).filter((m) => m.status !== 'complete' && m.team_a_id && m.team_b_id);
  if (!incomplete.length) {
    log.info('All bracket matches are already complete (or all TBD).');
    return;
  }

  const maxRound = Math.max(...(allMatches ?? []).map((m) => m.round_number));

  const confirmed = await confirm({
    message: `Simulate ${incomplete.length} bracket match(es) across ${brackets.length} bracket(s)?`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s2 = spinner();
  s2.start('Simulating brackets...');

  const ppsMap = new Map(brackets.map((b) => [b.id, b.points_per_set as number]));
  let totalDone = 0;

  for (let round = 1; round <= maxRound; round++) {
    // Re-fetch each round so propagated teams from previous rounds are visible
    const { data: roundMatches } = await ctx.supabase
      .from('bracket_matches')
      .select('id, bracket_id, team_a_id, team_b_id, status')
      .in('bracket_id', bracketIds)
      .eq('round_number', round)
      .neq('status', 'complete');

    for (const match of roundMatches ?? []) {
      if (!match.team_a_id || !match.team_b_id) continue;

      const pps = ppsMap.get(match.bracket_id) ?? 15;
      const [a, b] = simulateSet(pps);

      await ctx.supabase.from('bracket_match_sets').delete().eq('bracket_match_id', match.id);
      await ctx.supabase.from('bracket_match_sets').insert({
        bracket_match_id: match.id,
        set_number: 1,
        team_a_score: a,
        team_b_score: b,
        submitted_by: 'sim',
        submitted_at: new Date().toISOString(),
      });

      await ctx.supabase
        .from('bracket_matches')
        .update({ status: 'complete', end_time: new Date().toISOString() })
        .eq('id', match.id);

      await ctx.supabase.rpc('propagate_bracket_winner', { completed_match_id: match.id });
      totalDone++;
    }
  }

  s2.stop(`${totalDone} bracket match(es) simulated.`);
}

// ─── Standings inspector ─────────────────────────────────────────────────────

export async function standingsInspector(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Computing standings...');

  const { data: pools } = await ctx.supabase
    .from('pools')
    .select('id, pool_label, court_number, pool_teams(team_id, seed_in_pool, teams(team_name, seed, withdrawn_at))')
    .eq('tournament_id', ctx.tournamentId);

  if (!pools?.length) {
    s.stop('');
    log.warn('No pools found. Generate pools first.');
    return;
  }

  const { data: allMatches } = await ctx.supabase
    .from('matches')
    .select('id, pool_id, team_a_id, team_b_id, status, match_sets(set_number, team_a_score, team_b_score)')
    .eq('tournament_id', ctx.tournamentId);

  s.stop('');

  const poolStandings = pools.map((pool) => {
    const poolTeams = (pool.pool_teams as any[]).map((pt) => ({
      team_id: pt.team_id,
      team_name: (pt.teams as any).team_name,
      seed_in_pool: pt.seed_in_pool,
      overall_seed: (pt.teams as any).seed,
      withdrawn: !!(pt.teams as any).withdrawn_at,
    }));

    const activeTeams = poolTeams.filter((t) => !t.withdrawn);
    const format = getMatchFormat(activeTeams.length, ctx.awesomefest);

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

    return {
      pool_id: pool.id,
      pool_label: pool.pool_label,
      court_number: pool.court_number,
      standings: computePoolStandings(poolTeams, poolMatches, format),
    };
  });

  // Pool standings
  for (const pool of poolStandings) {
    const rows = pool.standings.map((t, i) => {
      const wd = t.withdrawn ? ' [WD]' : '';
      const rec = `${t.matches_won}W-${t.matches_lost}L`;
      const diff = t.point_differential >= 0 ? `+${t.point_differential}` : String(t.point_differential);
      return `  ${String(i + 1).padStart(2)}. ${t.team_name.padEnd(22).slice(0, 22)}  ${rec.padEnd(6)}  Diff: ${diff}${wd}`;
    });
    log.info(`Pool ${pool.pool_label} — Court ${pool.court_number}\n${rows.join('\n')}`);
  }

  // Overall standings
  const overall = computeOverallStandings(poolStandings);
  const defaultCutoff = getDefaultGoldCutoff(overall, pools.length);
  const rows = overall.map((t) => {
    const rec = `${t.matches_won}W-${t.matches_lost}L`;
    const diff = t.point_differential >= 0 ? `+${t.point_differential}` : String(t.point_differential);
    const tier = t.overall_rank <= defaultCutoff ? '🥇' : '🥈';
    return `  ${String(t.overall_rank).padStart(2)}. ${tier} ${t.team_name.padEnd(20).slice(0, 20)}  Pool ${t.pool_label}  ${rec}  Diff: ${diff}`;
  });
  log.info(`Overall Standings (${overall.length} teams, gold cut: top ${defaultCutoff})\n${rows.join('\n')}`);
}

// ─── Persist bracket (shared with full simulation) ──────────────────────────

async function persistBracket(
  ctx: CliContext,
  teams: any[],
  bracketType: 'gold' | 'silver',
  pointsPerSet: 11 | 15 | 21,
  courts: number[],
  matchOrderOffset: number,
): Promise<number> {
  const generated = generateBracket(teams, bracketType, pointsPerSet, courts, matchOrderOffset);
  if (generated.slots.length === 0) return 0;

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

  const expiresAt = tokenExpiryForTournament(ctx.tournamentDate).toISOString();

  for (const gm of generated.matches) {
    const winnerRound = gm.round_number + 1;
    const { data: match } = await ctx.supabase
      .from('bracket_matches')
      .insert({
        bracket_id: bracketRecord.id,
        round_number: gm.round_number,
        match_position: gm.match_position,
        slot_a_id: slotMap.get(`${gm.round_number}:${gm.slot_a_position}`) ?? null,
        slot_b_id: slotMap.get(`${gm.round_number}:${gm.slot_b_position}`) ?? null,
        winner_slot_id: winnerRound <= totalRounds
          ? slotMap.get(`${winnerRound}:${gm.match_position}`) ?? null
          : null,
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
        bracket_match_id: match.id,
        token: generateMatchToken(),
        expires_at: expiresAt,
      });
    }
  }

  return generated.matches.length;
}

// ─── Full simulation ─────────────────────────────────────────────────────────

async function fullSimulationAction(ctx: CliContext): Promise<void> {
  const countInput = await text({
    message: 'Teams to seed:',
    placeholder: '8',
    validate: (v) => { const n = parseInt(v ?? ''); if (isNaN(n) || n < 2) return 'At least 2'; },
  });
  if (isCancel(countInput)) return;
  const teamCount = parseInt(countInput as string);

  const netInput = await text({
    message: 'Number of nets (pools):',
    placeholder: '2',
    validate: (v) => { const n = parseInt(v ?? ''); if (isNaN(n) || n < 1) return 'At least 1'; },
  });
  if (isCancel(netInput)) return;
  const netCount = parseInt(netInput as string);

  let pointsPerSet: 11 | 15 | 21;
  if (ctx.awesomefest) {
    pointsPerSet = 21;
    log.info('AwesomeFest tournament — games to 21, single bracket (everyone makes playoffs).');
  } else {
    const ptsChoice = await select({
      message: 'Bracket points per set:',
      options: [
        { value: '15', label: '15 pts' },
        { value: '11', label: '11 pts' },
      ],
    });
    if (isCancel(ptsChoice)) return;
    pointsPerSet = parseInt(ptsChoice as string) as 11 | 15;
  }

  const confirmed = await confirm({
    message: `Full simulation: ${teamCount} teams, ${netCount} net(s), ${pointsPerSet}pts/set. Wipe existing data first?`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s = spinner();

  // 1. Clean
  s.start('Cleaning...');
  await cleanTournament(ctx);

  // 2. Seed teams
  s.message(`Seeding ${teamCount} teams...`);
  await doSeedTeams(ctx, teamCount);

  // 3. Generate pools
  s.message('Generating pools...');
  const { data: teamRows } = await ctx.supabase
    .from('teams')
    .select('id, team_name, seed')
    .eq('tournament_id', ctx.tournamentId)
    .is('withdrawn_at', null);

  const poolResult = generatePools({
    teams: (teamRows ?? []).map((t) => ({ id: t.id, team_name: t.team_name, seed: t.seed })),
    netCount,
  });

  if ('error' in poolResult) {
    s.stop('');
    log.error(`Pool generation failed: ${poolResult.error}`);
    return;
  }

  for (const pool of poolResult.pools) {
    const { data: poolRecord } = await ctx.supabase
      .from('pools')
      .insert({ tournament_id: ctx.tournamentId, pool_label: pool.pool_label, court_number: pool.court_number })
      .select()
      .single();
    if (!poolRecord) continue;

    await ctx.supabase.from('pool_teams').insert(
      pool.team_ids.map((teamId, i) => ({ pool_id: poolRecord.id, team_id: teamId, seed_in_pool: i + 1 })),
    );
  }

  // 4. Generate matches
  s.message('Generating matches...');
  const { data: generatedPools } = await ctx.supabase
    .from('pools')
    .select('id, court_number, pool_teams(team_id, seed_in_pool)')
    .eq('tournament_id', ctx.tournamentId);

  const expiresAt = tokenExpiryForTournament(ctx.tournamentDate).toISOString();

  for (const pool of generatedPools ?? []) {
    const teams = pool.pool_teams as Array<{ team_id: string; seed_in_pool: number }>;
    const generated = generatePoolMatches({ pool_id: pool.id, court_number: pool.court_number, teams });

    for (const gm of generated) {
      const { data: match } = await ctx.supabase
        .from('matches')
        .insert({
          tournament_id: ctx.tournamentId,
          pool_id: pool.id,
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
        await ctx.supabase.from('match_tokens').insert({
          match_id: match.id,
          token: generateMatchToken(),
          expires_at: expiresAt,
        });
      }
    }
  }

  // 5. Simulate pool play
  s.message('Simulating pool play...');
  const { data: allMatches } = await ctx.supabase
    .from('matches')
    .select('id, pool_id')
    .eq('tournament_id', ctx.tournamentId);

  const allPoolIds = [...new Set((allMatches ?? []).map((m) => m.pool_id))];
  const { data: allPoolTeams } = await ctx.supabase
    .from('pool_teams')
    .select('pool_id')
    .in('pool_id', allPoolIds);

  const poolSizeMap = new Map<string, number>();
  for (const pt of allPoolTeams ?? []) {
    poolSizeMap.set(pt.pool_id, (poolSizeMap.get(pt.pool_id) ?? 0) + 1);
  }

  for (const match of allMatches ?? []) {
    const format = getMatchFormat(poolSizeMap.get(match.pool_id) ?? 4, ctx.awesomefest);
    const sets = Array.from({ length: format.sets }, (_, i) => {
      const [a, b] = simulateSet(format.pointsPerSet, format.pointsCap);
      return { match_id: match.id, set_number: i + 1, team_a_score: a, team_b_score: b, submitted_by: 'sim' };
    });
    await ctx.supabase.from('match_sets').insert(sets);
    await ctx.supabase
      .from('matches')
      .update({ status: 'complete', end_time: new Date().toISOString() })
      .eq('id', match.id);
  }

  // 6. Compute standings and generate brackets
  s.message('Computing standings...');
  const { data: pools } = await ctx.supabase
    .from('pools')
    .select('id, pool_label, court_number, pool_teams(team_id, seed_in_pool, teams(team_name, seed, withdrawn_at))')
    .eq('tournament_id', ctx.tournamentId);

  const { data: completedMatches } = await ctx.supabase
    .from('matches')
    .select('id, pool_id, team_a_id, team_b_id, status, match_sets(set_number, team_a_score, team_b_score)')
    .eq('tournament_id', ctx.tournamentId);

  const poolStandings = (pools ?? []).map((pool) => {
    const poolTeams = (pool.pool_teams as any[]).map((pt) => ({
      team_id: pt.team_id,
      team_name: (pt.teams as any).team_name,
      seed_in_pool: pt.seed_in_pool,
      overall_seed: (pt.teams as any).seed,
      withdrawn: !!(pt.teams as any).withdrawn_at,
    })).filter((t) => !t.withdrawn);

    const format = getMatchFormat(poolTeams.length, ctx.awesomefest);
    const poolMatches = (completedMatches ?? [])
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

    return {
      pool_id: pool.id,
      pool_label: pool.pool_label,
      court_number: pool.court_number,
      standings: computePoolStandings(poolTeams, poolMatches, format),
    };
  });

  const overallStandings = computeOverallStandings(poolStandings);
  // AwesomeFest: one bracket, everyone makes playoffs — no gold/silver split.
  const goldCutoff = ctx.awesomefest
    ? overallStandings.length
    : getDefaultGoldCutoff(overallStandings, (pools ?? []).length);
  const goldTeams = overallStandings.slice(0, goldCutoff);
  const silverTeams = overallStandings.slice(goldCutoff);

  // Split courts between brackets (odd extra goes to the bracket with more R1 games)
  // No silver bracket will actually be generated below 2 teams — give gold every court.
  const goldR1 = countR1Games(goldTeams.length);
  const silverR1 = countR1Games(silverTeams.length);
  const half = Math.floor(netCount / 2);
  const extra = netCount % 2;
  const goldGetsExtra = goldR1 >= silverR1;
  const goldCourtCount = silverTeams.length < 2 ? netCount : half + (goldGetsExtra ? extra : 0);
  const silverCourtCount = silverTeams.length < 2 ? 0 : half + (goldGetsExtra ? 0 : extra);
  const goldCourts = Array.from({ length: goldCourtCount }, (_, i) => i + 1);
  const silverCourts = Array.from({ length: silverCourtCount }, (_, i) => goldCourts.length + i + 1);

  s.message('Generating brackets...');
  const goldCount = await persistBracket(ctx, goldTeams, 'gold', pointsPerSet, goldCourts, 0);
  const silverCount = silverTeams.length >= 2
    ? await persistBracket(ctx, silverTeams, 'silver', pointsPerSet, silverCourts, goldCount)
    : 0;

  // 7. Simulate bracket play
  s.message('Simulating brackets...');
  const { data: newBrackets } = await ctx.supabase
    .from('brackets')
    .select('id, points_per_set')
    .eq('tournament_id', ctx.tournamentId);

  const newBracketIds = (newBrackets ?? []).map((b) => b.id);
  const ppsMap = new Map((newBrackets ?? []).map((b) => [b.id, b.points_per_set as number]));

  const { data: bracketMatches } = await ctx.supabase
    .from('bracket_matches')
    .select('round_number')
    .in('bracket_id', newBracketIds)
    .order('round_number', { ascending: false })
    .limit(1);

  const maxRound = bracketMatches?.[0]?.round_number ?? 0;

  for (let round = 1; round <= maxRound; round++) {
    const { data: roundMatches } = await ctx.supabase
      .from('bracket_matches')
      .select('id, bracket_id, team_a_id, team_b_id')
      .in('bracket_id', newBracketIds)
      .eq('round_number', round)
      .neq('status', 'complete');

    for (const match of roundMatches ?? []) {
      if (!match.team_a_id || !match.team_b_id) continue;

      const pps = ppsMap.get(match.bracket_id) ?? 15;
      const [a, b] = simulateSet(pps);

      await ctx.supabase.from('bracket_match_sets').insert({
        bracket_match_id: match.id,
        set_number: 1,
        team_a_score: a,
        team_b_score: b,
        submitted_by: 'sim',
        submitted_at: new Date().toISOString(),
      });

      await ctx.supabase
        .from('bracket_matches')
        .update({ status: 'complete', end_time: new Date().toISOString() })
        .eq('id', match.id);

      await ctx.supabase.rpc('propagate_bracket_winner', { completed_match_id: match.id });
    }
  }

  s.stop(
    `Done! ${teamCount} teams → ${poolResult.pools.length} pool(s) → ${allMatches?.length ?? 0} pool matches → Gold (${goldCount}) + Silver (${silverCount}) bracket matches — fully simulated.`,
  );
}

// ─── Reset tournament ─────────────────────────────────────────────────────────

async function resetTournamentAction(ctx: CliContext): Promise<void> {
  const confirmed = await confirm({
    message: `DELETE all data for "${ctx.tournamentName}"? (teams, pools, matches, brackets)`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s = spinner();
  s.start('Wiping tournament data...');
  await cleanTournament(ctx);
  s.stop('Tournament data cleared.');
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export async function devMenu(ctx: CliContext): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Dev Tools  [LOCAL ONLY]',
      options: [
        { value: 'seed', label: 'Seed teams', hint: 'create fake teams + players' },
        { value: 'sim-pools', label: 'Simulate pool play', hint: 'auto-fill all match scores' },
        { value: 'sim-brackets', label: 'Simulate bracket play', hint: 'fill scores round by round' },
        { value: 'full-sim', label: 'Full simulation', hint: 'seed → pools → matches → play → brackets' },
        { value: 'reset', label: 'Reset tournament', hint: 'wipe all data for this tournament' },
        { value: 'back', label: '← Back' },
      ],
    });

    if (isCancel(action) || action === 'back') return;

    switch (action) {
      case 'seed':        await seedTeamsAction(ctx); break;
      case 'sim-pools':   await simulatePoolPlayAction(ctx); break;
      case 'sim-brackets': await simulateBracketPlayAction(ctx); break;
      case 'full-sim':    await fullSimulationAction(ctx); break;
      case 'reset':       await resetTournamentAction(ctx); break;
    }
  }
}
