import { select, text, confirm, spinner, isCancel, log } from '@clack/prompts';
import type { CliContext } from '../db';
import { generatePools } from '../../../src/lib/pool-generation';

async function viewPools(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading pools...');

  const { data: pools } = await ctx.supabase
    .from('pools')
    .select('id, pool_label, court_number')
    .eq('tournament_id', ctx.tournamentId)
    .order('pool_label');

  if (!pools?.length) {
    s.stop('');
    log.warn('No pools generated yet.');
    return;
  }

  const poolIds = pools.map((p) => p.id);
  const { data: poolTeams } = await ctx.supabase
    .from('pool_teams')
    .select('pool_id, seed_in_pool, team_id')
    .in('pool_id', poolIds)
    .order('seed_in_pool');

  const teamIds = [...new Set(poolTeams?.map((pt) => pt.team_id) ?? [])];
  const { data: teams } = await ctx.supabase
    .from('teams')
    .select('id, team_name, withdrawn_at')
    .in('id', teamIds);

  s.stop('');

  const teamMap = new Map(teams?.map((t) => [t.id, t]) ?? []);
  const poolTeamMap = new Map<string, typeof poolTeams>();
  for (const pt of poolTeams ?? []) {
    if (!poolTeamMap.has(pt.pool_id)) poolTeamMap.set(pt.pool_id, []);
    poolTeamMap.get(pt.pool_id)!.push(pt);
  }

  for (const pool of pools) {
    const members = (poolTeamMap.get(pool.id) ?? []).sort(
      (a, b) => a.seed_in_pool - b.seed_in_pool,
    );
    const rows = members.map((pt) => {
      const team = teamMap.get(pt.team_id);
      const name = team?.team_name ?? '?';
      const withdrawn = team?.withdrawn_at ? ' [WITHDRAWN]' : '';
      return `  ${pt.seed_in_pool}. ${name}${withdrawn}`;
    });
    log.info(`Pool ${pool.pool_label} — Court ${pool.court_number}\n${rows.join('\n')}`);
  }
}

async function generatePoolsAction(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading teams and pools...');

  const [{ count: existingPoolCount }, { data: teams }] = await Promise.all([
    ctx.supabase
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', ctx.tournamentId),
    ctx.supabase
      .from('teams')
      .select('id, team_name, seed')
      .eq('tournament_id', ctx.tournamentId)
      .is('withdrawn_at', null),
  ]);

  s.stop('');

  if (!teams?.length) {
    log.error('No active teams registered.');
    return;
  }

  if (existingPoolCount && existingPoolCount > 0) {
    const overwrite = await confirm({
      message: `${existingPoolCount} pool(s) already exist. Delete and regenerate?`,
    });
    if (isCancel(overwrite) || !overwrite) return;
  }

  log.info(`${teams.length} active teams available.`);

  const netInput = await text({
    message: 'Number of nets (pools):',
    placeholder: '4',
    validate: (v) => {
      const n = parseInt(v ?? '');
      if (isNaN(n) || n < 1) return 'Enter a positive number';
    },
  });
  if (isCancel(netInput)) return;

  const netCount = parseInt(netInput as string);
  const result = generatePools({
    teams: teams.map((t) => ({ id: t.id, team_name: t.team_name, seed: t.seed })),
    netCount,
  });

  if ('error' in result) {
    log.error(result.error);
    return;
  }

  const preview = result.pools
    .map((p) => `  Pool ${p.pool_label} — Court ${p.court_number} (${p.team_ids.length} teams)`)
    .join('\n');
  log.info('Preview:\n' + preview);

  const confirmed = await confirm({ message: 'Generate these pools?' });
  if (isCancel(confirmed) || !confirmed) return;

  const s2 = spinner();
  s2.start('Generating pools...');

  // Delete existing (cascades pool_teams)
  await ctx.supabase.from('pools').delete().eq('tournament_id', ctx.tournamentId);

  for (const pool of result.pools) {
    const { data: poolRecord, error } = await ctx.supabase
      .from('pools')
      .insert({
        tournament_id: ctx.tournamentId,
        pool_label: pool.pool_label,
        court_number: pool.court_number,
      })
      .select()
      .single();

    if (error || !poolRecord) {
      log.error(`Failed to create pool ${pool.pool_label}: ${error?.message ?? 'unknown error'}`);
      continue;
    }

    await ctx.supabase.from('pool_teams').insert(
      pool.team_ids.map((teamId, i) => ({
        pool_id: poolRecord.id,
        team_id: teamId,
        seed_in_pool: i + 1,
      })),
    );
  }

  s2.stop(`${result.pools.length} pool(s) created.`);
}

async function resetPools(ctx: CliContext): Promise<void> {
  const confirmed = await confirm({
    message:
      'Delete ALL pools? This also deletes all matches and brackets for this tournament.',
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s = spinner();
  s.start('Deleting pools, matches, and brackets...');
  // Delete in dependency order
  await ctx.supabase.from('brackets').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('matches').delete().eq('tournament_id', ctx.tournamentId);
  await ctx.supabase.from('pools').delete().eq('tournament_id', ctx.tournamentId);
  s.stop('Pools, matches, and brackets deleted.');
}

export async function poolsMenu(ctx: CliContext): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Pool Management',
      options: [
        { value: 'view', label: 'View pools' },
        { value: 'generate', label: 'Generate pools' },
        { value: 'reset', label: 'Reset all pools (+ matches + brackets)' },
        { value: 'back', label: '← Back' },
      ],
    });

    if (isCancel(action) || action === 'back') return;

    switch (action) {
      case 'view':
        await viewPools(ctx);
        break;
      case 'generate':
        await generatePoolsAction(ctx);
        break;
      case 'reset':
        await resetPools(ctx);
        break;
    }
  }
}
