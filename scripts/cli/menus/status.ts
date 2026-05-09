import { log, spinner } from '@clack/prompts';
import type { CliContext } from '../db';

export async function showStatus(ctx: CliContext): Promise<void> {
  const { supabase, tournamentId } = ctx;
  const s = spinner();
  s.start('Loading tournament status...');

  const [teamsRes, poolCountRes, matchesRes, bracketsRes] = await Promise.all([
    supabase
      .from('teams')
      .select('id, checked_in, withdrawn_at')
      .eq('tournament_id', tournamentId),
    supabase
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabase.from('matches').select('id, status').eq('tournament_id', tournamentId),
    supabase.from('brackets').select('id, bracket_type').eq('tournament_id', tournamentId),
  ]);

  if (teamsRes.error) {
    s.stop('');
    log.error(`Failed to fetch teams: ${teamsRes.error.message}`);
    return;
  }
  if (poolCountRes.error) {
    s.stop('');
    log.error(`Failed to fetch pools: ${poolCountRes.error.message}`);
    return;
  }
  if (matchesRes.error) {
    s.stop('');
    log.error(`Failed to fetch matches: ${matchesRes.error.message}`);
    return;
  }
  if (bracketsRes.error) {
    s.stop('');
    log.error(`Failed to fetch brackets: ${bracketsRes.error.message}`);
    return;
  }

  const teams = teamsRes.data ?? [];
  const totalTeams = teams.length;
  const checkedIn = teams.filter((t) => t.checked_in && !t.withdrawn_at).length;
  const withdrawn = teams.filter((t) => t.withdrawn_at).length;
  const poolCount = poolCountRes.count ?? 0;

  const matches = matchesRes.data ?? [];
  const totalMatches = matches.length;
  const completeMatches = matches.filter((m) => m.status === 'complete').length;
  const inProgressIds = matches.filter((m) => m.status === 'in_progress').map((m) => m.id);

  const brackets = bracketsRes.data ?? [];

  // Bracket match progress
  let bracketLine = 'Not generated';
  if (brackets.length > 0) {
    const bracketIds = brackets.map((b) => b.id);
    const { data: bMatches } = await supabase
      .from('bracket_matches')
      .select('status')
      .in('bracket_id', bracketIds);

    const bTotal = bMatches?.length ?? 0;
    const bDone = bMatches?.filter((m) => m.status === 'complete').length ?? 0;
    const types = brackets.map((b) => b.bracket_type).join(' + ');
    bracketLine = `${types} — ${bDone}/${bTotal} complete`;
  }

  // In-progress match details
  let inProgressLines: string[] = [];
  if (inProgressIds.length > 0) {
    const { data: details } = await supabase
      .from('matches')
      .select('id, court_number, match_order, team_a_id, team_b_id, pool_id')
      .in('id', inProgressIds);

    if (details?.length) {
      const teamIds = [
        ...new Set(details.flatMap((m) => [m.team_a_id, m.team_b_id])),
      ];
      const poolIds = [...new Set(details.map((m) => m.pool_id))];

      const [{ data: teamRows }, { data: poolRows }] = await Promise.all([
        supabase.from('teams').select('id, team_name').in('id', teamIds),
        supabase.from('pools').select('id, pool_label').in('id', poolIds),
      ]);

      const teamMap = new Map(teamRows?.map((t) => [t.id, t.team_name]) ?? []);
      const poolMap = new Map(poolRows?.map((p) => [p.id, p.pool_label]) ?? []);

      inProgressLines = details.map((m) => {
        const pool = poolMap.get(m.pool_id) ?? '?';
        const a = teamMap.get(m.team_a_id) ?? '?';
        const b = teamMap.get(m.team_b_id) ?? '?';
        return `  Pool ${pool} · Court ${m.court_number} · Match #${m.match_order}   ${a} vs ${b}`;
      });
    }
  }

  s.stop('');

  const matchLine =
    totalMatches > 0
      ? `${completeMatches}/${totalMatches} complete (${Math.round((completeMatches / totalMatches) * 100)}%)`
      : 'Not generated';

  log.info(
    [
      '',
      `  Tournament:  ${ctx.tournamentName}`,
      `  Date:        ${new Date(ctx.tournamentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}`,
      `  Env:         ${ctx.env.toUpperCase()}`,
      '',
      `  Teams:       ${totalTeams} registered / ${checkedIn} checked in / ${withdrawn} withdrawn`,
      `  Pools:       ${poolCount} pool${poolCount === 1 ? '' : 's'}`,
      `  Pool Play:   ${matchLine}`,
      `  Brackets:    ${bracketLine}`,
      '',
    ].join('\n'),
  );

  if (inProgressLines.length > 0) {
    log.warn('In Progress:\n' + inProgressLines.join('\n'));
  }
}
