import { select, text, confirm, spinner, isCancel, log } from '@clack/prompts';
import type { CliContext } from '../db';
import { generatePoolMatches } from '../../../src/lib/match-generation';
import { generateMatchToken, tokenExpiryForTournament } from '../../../src/lib/tokens';
import { getMatchFormat, isSetComplete } from '../../../src/lib/score-format';

async function viewMatches(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading matches...');

  const { data: matches } = await ctx.supabase
    .from('matches')
    .select('id, match_order, court_number, status, pool_id, team_a_id, team_b_id, work_team_id')
    .eq('tournament_id', ctx.tournamentId)
    .order('pool_id')
    .order('match_order');

  if (!matches?.length) {
    s.stop('');
    log.warn('No matches generated yet.');
    return;
  }

  const matchIds = matches.map((m) => m.id);
  const teamIds = [
    ...new Set(
      matches.flatMap((m) =>
        [m.team_a_id, m.team_b_id, m.work_team_id].filter(Boolean),
      ),
    ),
  ];
  const poolIds = [...new Set(matches.map((m) => m.pool_id))];

  const [{ data: teams }, { data: pools }, { data: sets }] = await Promise.all([
    ctx.supabase.from('teams').select('id, team_name').in('id', teamIds),
    ctx.supabase.from('pools').select('id, pool_label').in('id', poolIds),
    ctx.supabase
      .from('match_sets')
      .select('match_id, set_number, team_a_score, team_b_score')
      .in('match_id', matchIds)
      .order('set_number'),
  ]);

  s.stop('');

  const teamMap = new Map(teams?.map((t) => [t.id, t.team_name]) ?? []);
  const poolMap = new Map(pools?.map((p) => [p.id, p.pool_label]) ?? []);
  const setsMap = new Map<string, typeof sets>();
  for (const set of sets ?? []) {
    if (!setsMap.has(set.match_id)) setsMap.set(set.match_id, []);
    setsMap.get(set.match_id)!.push(set);
  }

  // Group matches by pool
  const byPool = new Map<string, typeof matches>();
  for (const m of matches) {
    const label = poolMap.get(m.pool_id) ?? '?';
    if (!byPool.has(label)) byPool.set(label, []);
    byPool.get(label)!.push(m);
  }

  for (const [poolLabel, poolMatches] of byPool) {
    const rows = poolMatches.map((m) => {
      const a = teamMap.get(m.team_a_id) ?? '?';
      const b = teamMap.get(m.team_b_id) ?? '?';
      const matchSets = setsMap.get(m.id) ?? [];
      const score =
        matchSets.length > 0
          ? matchSets.map((s) => `${s.team_a_score}-${s.team_b_score}`).join(', ')
          : '-';
      const icon =
        m.status === 'complete' ? '✓' : m.status === 'in_progress' ? '▶' : '·';
      return `  ${icon} #${String(m.match_order).padStart(2)}  Crt ${m.court_number}  ${a.padEnd(18).slice(0, 18)} vs ${b.padEnd(18).slice(0, 18)}  ${score}`;
    });
    const total = poolMatches.length;
    const done = poolMatches.filter((m) => m.status === 'complete').length;
    log.info(`Pool ${poolLabel}  (${done}/${total} done)\n${rows.join('\n')}`);
  }
}

async function viewLive(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading live matches...');

  const { data: matches } = await ctx.supabase
    .from('matches')
    .select('id, match_order, court_number, pool_id, team_a_id, team_b_id')
    .eq('tournament_id', ctx.tournamentId)
    .eq('status', 'in_progress');

  if (!matches?.length) {
    s.stop('');
    log.info('No matches currently in progress.');
    return;
  }

  const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]))];
  const poolIds = [...new Set(matches.map((m) => m.pool_id))];
  const matchIds = matches.map((m) => m.id);

  const [{ data: teams }, { data: pools }, { data: sets }] = await Promise.all([
    ctx.supabase.from('teams').select('id, team_name').in('id', teamIds),
    ctx.supabase.from('pools').select('id, pool_label').in('id', poolIds),
    ctx.supabase
      .from('match_sets')
      .select('match_id, set_number, team_a_score, team_b_score')
      .in('match_id', matchIds)
      .order('set_number'),
  ]);

  s.stop('');

  const teamMap = new Map(teams?.map((t) => [t.id, t.team_name]) ?? []);
  const poolMap = new Map(pools?.map((p) => [p.id, p.pool_label]) ?? []);
  const setsMap = new Map<string, typeof sets>();
  for (const set of sets ?? []) {
    if (!setsMap.has(set.match_id)) setsMap.set(set.match_id, []);
    setsMap.get(set.match_id)!.push(set);
  }

  const rows = matches.map((m) => {
    const pool = poolMap.get(m.pool_id) ?? '?';
    const a = teamMap.get(m.team_a_id) ?? '?';
    const b = teamMap.get(m.team_b_id) ?? '?';
    const score = (setsMap.get(m.id) ?? [])
      .map((s) => `${s.team_a_score}-${s.team_b_score}`)
      .join(', ');
    return `  Pool ${pool} · Court ${m.court_number} · Match #${m.match_order}   ${a} vs ${b}  [${score || '0-0'}]`;
  });

  log.info(`In Progress (${matches.length}):\n${rows.join('\n')}`);
}

async function generateMatchesAction(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading pools and matches...');

  const [{ count: existingCount }, { data: pools }] = await Promise.all([
    ctx.supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', ctx.tournamentId),
    ctx.supabase
      .from('pools')
      .select('id, pool_label, court_number, pool_teams(team_id, seed_in_pool)')
      .eq('tournament_id', ctx.tournamentId),
  ]);

  s.stop('');

  if (!pools?.length) {
    log.error('No pools found. Generate pools first.');
    return;
  }

  if (existingCount && existingCount > 0) {
    const overwrite = await confirm({
      message: `${existingCount} match(es) already exist. Delete and regenerate?`,
    });
    if (isCancel(overwrite) || !overwrite) return;
  }

  const confirmed = await confirm({
    message: `Generate round-robin matches for ${pools.length} pool(s)?`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s2 = spinner();
  s2.start('Generating matches...');

  // Delete existing (cascades match_sets, match_tokens, brackets)
  await ctx.supabase.from('brackets').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('matches').delete().eq('tournament_id', ctx.tournamentId);

  const expiresAt = tokenExpiryForTournament(ctx.tournamentDate).toISOString();
  let matchCount = 0;

  for (const pool of pools) {
    const teams = (pool.pool_teams as Array<{ team_id: string; seed_in_pool: number }>).map(
      (pt) => ({ team_id: pt.team_id, seed_in_pool: pt.seed_in_pool }),
    );

    const generated = generatePoolMatches({
      pool_id: pool.id,
      court_number: pool.court_number,
      teams,
    });

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
        matchCount++;
      }
    }
  }

  s2.stop(`${matchCount} matches generated with score submission tokens.`);
}

async function resetMatches(ctx: CliContext): Promise<void> {
  const confirmed = await confirm({
    message: 'Delete ALL matches and brackets? Pool assignments are preserved.',
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s = spinner();
  s.start('Deleting...');
  await ctx.supabase.from('brackets').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('matches').delete().eq('tournament_id', ctx.tournamentId);
  s.stop('Matches and brackets deleted.');
}

async function editMatchScore(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading matches...');

  const { data: matches } = await ctx.supabase
    .from('matches')
    .select('id, match_order, court_number, status, pool_id, team_a_id, team_b_id')
    .eq('tournament_id', ctx.tournamentId)
    .order('pool_id')
    .order('match_order');

  if (!matches?.length) {
    s.stop('');
    log.warn('No matches found.');
    return;
  }

  const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id].filter(Boolean)))];
  const poolIds = [...new Set(matches.map((m) => m.pool_id))];
  const matchIds = matches.map((m) => m.id);

  const [{ data: teams }, { data: pools }, { data: poolTeams }, { data: sets }] = await Promise.all([
    ctx.supabase.from('teams').select('id, team_name').in('id', teamIds),
    ctx.supabase.from('pools').select('id, pool_label').in('id', poolIds),
    ctx.supabase.from('pool_teams').select('pool_id').in('pool_id', poolIds),
    ctx.supabase.from('match_sets').select('match_id, set_number, team_a_score, team_b_score').in('match_id', matchIds).order('set_number'),
  ]);

  s.stop('');

  const teamMap = new Map(teams?.map((t) => [t.id, t.team_name]) ?? []);
  const poolMap = new Map(pools?.map((p) => [p.id, p.pool_label]) ?? []);
  const setsMap = new Map<string, typeof sets>();
  for (const set of sets ?? []) {
    if (!setsMap.has(set.match_id)) setsMap.set(set.match_id, []);
    setsMap.get(set.match_id)!.push(set);
  }

  const poolSizeMap = new Map<string, number>();
  for (const pt of poolTeams ?? []) {
    poolSizeMap.set(pt.pool_id, (poolSizeMap.get(pt.pool_id) ?? 0) + 1);
  }

  // Display numbered list
  const header = ' #   Pool  Crt  Match   Team A               vs   Team B               Score';
  const divider = '─'.repeat(80);
  const rows = matches.map((m, i) => {
    const pool = poolMap.get(m.pool_id) ?? '?';
    const a = (teamMap.get(m.team_a_id) ?? '?').padEnd(20).slice(0, 20);
    const b = (teamMap.get(m.team_b_id) ?? '?').padEnd(20).slice(0, 20);
    const score = (setsMap.get(m.id) ?? []).map((s) => `${s.team_a_score}-${s.team_b_score}`).join(', ') || '-';
    const status = m.status === 'complete' ? '✓' : m.status === 'in_progress' ? '▶' : '·';
    return ` ${String(i + 1).padStart(2)}  ${status} ${pool.padEnd(4)}  ${String(m.court_number).padStart(3)}  #${String(m.match_order).padStart(4)}  ${a}  vs  ${b}  ${score}`;
  });
  log.info([header, divider, ...rows, ''].join('\n'));

  const pickInput = await text({
    message: 'Match number to edit (or press Enter to cancel):',
    placeholder: '1',
    validate: (v) => {
      if (!v?.trim()) return undefined;
      const n = parseInt(v);
      if (isNaN(n) || n < 1 || n > matches.length) return `Enter 1–${matches.length}`;
    },
  });
  if (isCancel(pickInput) || !(pickInput as string)?.trim()) return;

  const match = matches[parseInt(pickInput as string) - 1];
  const poolSize = poolSizeMap.get(match.pool_id) ?? 4;
  const format = getMatchFormat(poolSize);
  const a = teamMap.get(match.team_a_id) ?? '?';
  const b = teamMap.get(match.team_b_id) ?? '?';

  log.info(`Editing: ${a} vs ${b}  (${format.sets === 1 ? '1 set' : `${format.sets} sets`} to ${format.pointsPerSet}, cap ${format.pointsCap ?? '—'})`);

  const newSets: Array<{ set_number: number; team_a_score: number; team_b_score: number }> = [];

  for (let setNum = 1; setNum <= format.sets; setNum++) {
    const existing = setsMap.get(match.id)?.find((s) => s.set_number === setNum);
    const placeholder = existing ? `${existing.team_a_score}-${existing.team_b_score}` : `${format.pointsPerSet}-0`;

    const scoreInput = await text({
      message: `Set ${setNum} score (format: A-B, e.g. 15-8):`,
      placeholder,
      validate: (v) => {
        if (!v?.trim()) return 'Enter a score';
        const parts = v.trim().split('-');
        if (parts.length !== 2) return 'Format: A-B (e.g. 15-8)';
        const [sa, sb] = parts.map(Number);
        if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0) return 'Must be non-negative numbers';
        if (!isSetComplete(sa, sb, format.pointsPerSet, format.pointsCap))
          return `Not a valid complete set (to ${format.pointsPerSet}, cap ${format.pointsCap ?? '∞'})`;
      },
    });
    if (isCancel(scoreInput)) return;

    const [sa, sb] = (scoreInput as string).trim().split('-').map(Number);
    newSets.push({ set_number: setNum, team_a_score: sa, team_b_score: sb });
  }

  const s2 = spinner();
  s2.start('Saving...');

  await ctx.supabase.from('match_sets').delete().eq('match_id', match.id);
  await ctx.supabase.from('match_sets').insert(
    newSets.map((s) => ({ ...s, match_id: match.id, submitted_by: 'admin' })),
  );
  await ctx.supabase
    .from('matches')
    .update({ status: 'complete', end_time: new Date().toISOString() })
    .eq('id', match.id);

  const scoreStr = newSets.map((s) => `${s.team_a_score}-${s.team_b_score}`).join(', ');
  s2.stop(`Saved: ${a} vs ${b} — ${scoreStr}`);
}

export async function matchesMenu(ctx: CliContext): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Match Management',
      options: [
        { value: 'view', label: 'View match schedule' },
        { value: 'live', label: 'View live matches' },
        { value: 'edit', label: 'Edit match score' },
        { value: 'generate', label: 'Generate matches' },
        { value: 'reset', label: 'Reset matches (+ brackets)' },
        { value: 'back', label: '← Back' },
      ],
    });

    if (isCancel(action) || action === 'back') return;

    switch (action) {
      case 'view':
        await viewMatches(ctx);
        break;
      case 'live':
        await viewLive(ctx);
        break;
      case 'edit':
        await editMatchScore(ctx);
        break;
      case 'generate':
        await generateMatchesAction(ctx);
        break;
      case 'reset':
        await resetMatches(ctx);
        break;
    }
  }
}
