import dotenv from 'dotenv';
import { resolve } from 'path';

// Load both env files and map to distinct CLI vars before any imports use process.env
const devVars = dotenv.config({ path: resolve(process.cwd(), '.env.development.local') }).parsed ?? {};
const liveVars = dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true }).parsed ?? {};

process.env.SUPABASE_URL_LOCAL = devVars.NEXT_PUBLIC_SUPABASE_URL ?? '';
process.env.SUPABASE_KEY_LOCAL = devVars.SUPABASE_SERVICE_ROLE_KEY ?? '';
process.env.SUPABASE_URL_LIVE = liveVars.NEXT_PUBLIC_SUPABASE_URL ?? '';
process.env.SUPABASE_KEY_LIVE = liveVars.SUPABASE_SERVICE_ROLE_KEY ?? '';

import { intro, outro, select, isCancel, log } from '@clack/prompts';
import { readFileSync } from 'fs';
import { createCliClient, type CliContext } from './db';
import { showStatus } from './menus/status';
import { teamsMenu } from './menus/teams';
import { poolsMenu } from './menus/pools';
import { matchesMenu } from './menus/matches';
import { bracketsMenu } from './menus/brackets';

interface TournamentConfig {
  id: string;
  name: string;
  date: string;
  format: string;
  teamSize: number;
  location: string;
}

async function main() {
  intro(' Long Volleyball — Admin CLI ');

  // Step 1: Environment
  const env = await select({
    message: 'Connect to:',
    options: [
      { value: 'local', label: 'Local', hint: 'development database' },
      { value: 'live', label: 'Live', hint: 'production database' },
    ],
  });

  if (isCancel(env)) {
    outro('Cancelled.');
    process.exit(0);
  }

  let supabase;
  try {
    supabase = createCliClient(env as 'local' | 'live');
  } catch (err: any) {
    log.error(err.message);
    process.exit(1);
  }

  // Step 2: Tournament
  let tournaments: TournamentConfig[];
  try {
    const raw = readFileSync(resolve(process.cwd(), 'src/config/tournaments.json'), 'utf-8');
    tournaments = (JSON.parse(raw) as { tournaments: TournamentConfig[] }).tournaments;
  } catch {
    log.error('Could not read src/config/tournaments.json. Run this from the project root.');
    process.exit(1);
  }

  const tournamentChoice = await select({
    message: 'Tournament:',
    options: tournaments.map((t) => ({
      value: t.id,
      label: t.name,
      hint: new Date(t.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    })),
  });

  if (isCancel(tournamentChoice)) {
    outro('Cancelled.');
    process.exit(0);
  }

  const tournament = tournaments.find((t) => t.id === tournamentChoice)!;

  const ctx: CliContext = {
    supabase,
    env: env as 'local' | 'live',
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    tournamentDate: tournament.date,
    teamSize: tournament.teamSize,
  };

  // Step 3: Main menu loop
  while (true) {
    const action = await select({
      message: `[${ctx.env.toUpperCase()}] ${ctx.tournamentName}`,
      options: [
        { value: 'status', label: 'Tournament Status', hint: 'overview of teams, matches, brackets' },
        { value: 'teams', label: 'Team Management', hint: 'seed, check-in, withdraw, delete' },
        { value: 'pools', label: 'Pool Management', hint: 'generate, view, reset' },
        { value: 'matches', label: 'Match Management', hint: 'generate, view live, reset' },
        { value: 'brackets', label: 'Bracket Management', hint: 'generate, view, reset' },
        { value: 'exit', label: 'Exit' },
      ],
    });

    if (isCancel(action) || action === 'exit') break;

    switch (action) {
      case 'status':
        await showStatus(ctx);
        break;
      case 'teams':
        await teamsMenu(ctx);
        break;
      case 'pools':
        await poolsMenu(ctx);
        break;
      case 'matches':
        await matchesMenu(ctx);
        break;
      case 'brackets':
        await bracketsMenu(ctx);
        break;
    }
  }

  outro('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
