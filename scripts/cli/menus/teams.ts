import { select, text, confirm, spinner, isCancel, log } from '@clack/prompts';
import type { CliContext } from '../db';
import { generateForfeitScores } from '../../../src/lib/forfeit-handling';

interface Team {
  id: string;
  team_name: string;
  seed: number | null;
  checked_in: boolean;
  withdrawn_at: string | null;
}

async function fetchTeams(ctx: CliContext): Promise<Team[]> {
  const { data } = await ctx.supabase
    .from('teams')
    .select('id, team_name, seed, checked_in, withdrawn_at')
    .eq('tournament_id', ctx.tournamentId)
    .order('seed', { ascending: true, nullsFirst: false })
    .order('team_name');
  return data ?? [];
}

function displayTeams(teams: Team[]): void {
  if (teams.length === 0) {
    log.warn('No teams registered.');
    return;
  }
  const header = ' #   Team Name                      Seed  Check-in  Status';
  const divider = '─'.repeat(58);
  const rows = teams.map((t, i) => {
    const num = String(i + 1).padStart(2);
    const name = t.team_name.padEnd(30).slice(0, 30);
    const seed = (t.seed != null ? String(t.seed) : '-').padStart(4);
    const checkin = t.checked_in ? '✓' : '-';
    const status = t.withdrawn_at ? '[WITHDRAWN]' : '';
    return ` ${num}  ${name}  ${seed}       ${checkin}   ${status}`;
  });
  log.info([header, divider, ...rows, ''].join('\n'));
}

async function selectTeam(teams: Team[], message: string): Promise<Team | null> {
  displayTeams(teams);
  const input = await text({
    message,
    placeholder: '1',
    validate: (v) => {
      const n = parseInt(v ?? '');
      if (isNaN(n) || n < 1 || n > teams.length) return `Enter a number 1–${teams.length}`;
    },
  });
  if (isCancel(input)) return null;
  return teams[parseInt(input as string) - 1];
}

async function listTeams(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading teams...');
  const teams = await fetchTeams(ctx);
  s.stop('');
  displayTeams(teams);
  log.info(
    `Total: ${teams.length}  |  Checked in: ${teams.filter((t) => t.checked_in && !t.withdrawn_at).length}  |  Withdrawn: ${teams.filter((t) => t.withdrawn_at).length}`,
  );
}

async function setSeed(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading teams...');
  const teams = await fetchTeams(ctx);
  s.stop('');

  const team = await selectTeam(teams, 'Select team to seed (enter #):');
  if (!team) return;

  const seedInput = await text({
    message: `New seed for "${team.team_name}" (0 = unseeded):`,
    placeholder: String(team.seed ?? 0),
    validate: (v) => {
      const n = parseInt(v ?? '');
      if (isNaN(n) || n < 0) return 'Enter a non-negative number';
    },
  });
  if (isCancel(seedInput)) return;

  const seed = parseInt(seedInput as string);
  const s2 = spinner();
  s2.start('Updating...');
  await ctx.supabase
    .from('teams')
    .update({ seed: seed === 0 ? null : seed })
    .eq('id', team.id);
  s2.stop(`"${team.team_name}" seed → ${seed === 0 ? 'unseeded' : seed}`);
}

async function toggleCheckin(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading teams...');
  const teams = (await fetchTeams(ctx)).filter((t) => !t.withdrawn_at);
  s.stop('');

  if (!teams.length) {
    log.warn('No active teams.');
    return;
  }

  const team = await selectTeam(teams, 'Select team to toggle check-in (enter #):');
  if (!team) return;

  const newValue = !team.checked_in;
  const s2 = spinner();
  s2.start('Updating...');
  await ctx.supabase.from('teams').update({ checked_in: newValue }).eq('id', team.id);
  s2.stop(`"${team.team_name}" → ${newValue ? 'CHECKED IN' : 'checked out'}`);
}

async function bulkCheckin(ctx: CliContext): Promise<void> {
  const confirmed = await confirm({
    message: 'Mark ALL non-withdrawn teams as checked in?',
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s = spinner();
  s.start('Checking in all teams...');
  await ctx.supabase
    .from('teams')
    .update({ checked_in: true })
    .eq('tournament_id', ctx.tournamentId)
    .is('withdrawn_at', null);
  s.stop('All active teams checked in.');
}

async function withdrawTeam(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading teams...');
  const teams = (await fetchTeams(ctx)).filter((t) => !t.withdrawn_at);
  s.stop('');

  if (!teams.length) {
    log.warn('No active teams to withdraw.');
    return;
  }

  const team = await selectTeam(teams, 'Select team to withdraw (enter #):');
  if (!team) return;

  const confirmed = await confirm({
    message: `Withdraw "${team.team_name}"? Remaining matches will be forfeited.`,
  });
  if (isCancel(confirmed) || !confirmed) return;

  const s2 = spinner();
  s2.start('Processing withdrawal...');

  await ctx.supabase
    .from('teams')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('id', team.id);

  // Get pool membership to determine pool size for forfeit scores
  const { data: poolMembership } = await ctx.supabase
    .from('pool_teams')
    .select('pool_id')
    .eq('team_id', team.id)
    .maybeSingle();

  let poolSize = 0;
  if (poolMembership?.pool_id) {
    const { count } = await ctx.supabase
      .from('pool_teams')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolMembership.pool_id);
    poolSize = count ?? 0;
  }

  // Get all incomplete pool play matches for this team
  const { data: incompleteMatches } = await ctx.supabase
    .from('matches')
    .select('id, team_a_id, team_b_id')
    .eq('tournament_id', ctx.tournamentId)
    .in('status', ['scheduled', 'in_progress'])
    .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`);

  let forfeited = 0;
  if (incompleteMatches?.length && poolSize > 0) {
    const forfeits = generateForfeitScores(
      incompleteMatches.map((m) => ({
        match_id: m.id,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        pool_size: poolSize,
      })),
      team.id,
    );

    for (const forfeit of forfeits) {
      await ctx.supabase.from('match_sets').insert(
        forfeit.sets.map((s) => ({
          match_id: forfeit.match_id,
          set_number: s.set_number,
          team_a_score: s.team_a_score,
          team_b_score: s.team_b_score,
          submitted_by: 'admin',
          is_forfeit: true,
        })),
      );
      await ctx.supabase
        .from('matches')
        .update({ status: 'complete', end_time: new Date().toISOString() })
        .eq('id', forfeit.match_id);
      forfeited++;
    }
  }

  // Clear work team assignments for remaining matches
  await ctx.supabase
    .from('matches')
    .update({ work_team_id: null })
    .eq('tournament_id', ctx.tournamentId)
    .eq('work_team_id', team.id)
    .in('status', ['scheduled', 'in_progress']);

  s2.stop(`"${team.team_name}" withdrawn. ${forfeited} match(es) forfeited.`);
}

async function deleteTeam(ctx: CliContext): Promise<void> {
  const s = spinner();
  s.start('Loading teams...');
  const teams = await fetchTeams(ctx);
  s.stop('');

  const team = await selectTeam(teams, 'Select team to DELETE (enter #):');
  if (!team) return;

  const nameConfirm = await text({
    message: `Type the team name to confirm: "${team.team_name}"`,
    validate: (v) => (v !== team.team_name ? 'Name does not match' : undefined),
  });
  if (isCancel(nameConfirm)) return;

  const s2 = spinner();
  s2.start('Deleting...');
  await ctx.supabase.from('teams').delete().eq('id', team.id);
  s2.stop(`"${team.team_name}" deleted.`);
}

export async function teamsMenu(ctx: CliContext): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Team Management',
      options: [
        { value: 'list', label: 'List teams' },
        { value: 'seed', label: 'Set team seed' },
        { value: 'checkin', label: 'Toggle check-in' },
        { value: 'bulk-checkin', label: 'Bulk check-in all' },
        { value: 'withdraw', label: 'Withdraw team' },
        { value: 'delete', label: 'Delete team' },
        { value: 'back', label: '← Back' },
      ],
    });

    if (isCancel(action) || action === 'back') return;

    switch (action) {
      case 'list':
        await listTeams(ctx);
        break;
      case 'seed':
        await setSeed(ctx);
        break;
      case 'checkin':
        await toggleCheckin(ctx);
        break;
      case 'bulk-checkin':
        await bulkCheckin(ctx);
        break;
      case 'withdraw':
        await withdrawTeam(ctx);
        break;
      case 'delete':
        await deleteTeam(ctx);
        break;
    }
  }
}
