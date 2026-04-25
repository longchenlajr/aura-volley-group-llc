import { matchWinner, type MatchFormat } from "./score-format";

export interface TeamStanding {
  team_id: string;
  team_name: string;
  seed_in_pool: number;
  overall_seed: number | null;
  withdrawn: boolean;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  points_for: number;
  points_against: number;
  point_differential: number;
}

export interface PoolStandings {
  pool_id: string;
  pool_label: string;
  court_number: number;
  standings: TeamStanding[];
}

interface MatchInput {
  id: string;
  team_a_id: string;
  team_b_id: string;
  sets: Array<{ team_a_score: number; team_b_score: number }>;
  status: string;
}

interface TeamInput {
  team_id: string;
  team_name: string;
  seed_in_pool: number;
  overall_seed?: number | null;
  withdrawn?: boolean;
}

export function computePoolStandings(
  poolTeams: TeamInput[],
  matches: MatchInput[],
  format: MatchFormat,
): TeamStanding[] {
  // Initialize standings
  const standingsMap = new Map<string, TeamStanding>();
  for (const t of poolTeams) {
    standingsMap.set(t.team_id, {
      team_id: t.team_id,
      team_name: t.team_name,
      seed_in_pool: t.seed_in_pool,
      overall_seed: t.overall_seed ?? null,
      withdrawn: t.withdrawn ?? false,
      matches_played: 0,
      matches_won: 0,
      matches_lost: 0,
      sets_won: 0,
      sets_lost: 0,
      points_for: 0,
      points_against: 0,
      point_differential: 0,
    });
  }

  // Only count completed matches
  const completeMatches = matches.filter((m) => m.status === "complete" && m.sets.length > 0);

  // Build head-to-head results for tiebreaker
  const headToHead = new Map<string, string>(); // "teamA:teamB" → winner_id

  for (const m of completeMatches) {
    const a = standingsMap.get(m.team_a_id);
    const b = standingsMap.get(m.team_b_id);
    if (!a || !b) continue;

    const winner = matchWinner(
      m.sets.map((s, i) => ({ set_number: i + 1, ...s })),
      format,
    );

    a.matches_played++;
    b.matches_played++;

    if (winner === "team_a") {
      a.matches_won++;
      b.matches_lost++;
      headToHead.set(`${m.team_a_id}:${m.team_b_id}`, m.team_a_id);
      headToHead.set(`${m.team_b_id}:${m.team_a_id}`, m.team_a_id);
    } else if (winner === "team_b") {
      b.matches_won++;
      a.matches_lost++;
      headToHead.set(`${m.team_a_id}:${m.team_b_id}`, m.team_b_id);
      headToHead.set(`${m.team_b_id}:${m.team_a_id}`, m.team_b_id);
    }

    // Accumulate sets and points
    for (const set of m.sets) {
      const aWonSet = set.team_a_score > set.team_b_score;
      if (aWonSet) { a.sets_won++; b.sets_lost++; }
      else { b.sets_won++; a.sets_lost++; }

      a.points_for += set.team_a_score;
      a.points_against += set.team_b_score;
      b.points_for += set.team_b_score;
      b.points_against += set.team_a_score;
    }

    a.point_differential = a.points_for - a.points_against;
    b.point_differential = b.points_for - b.points_against;
  }

  // Sort with tiebreaker chain
  const standings = Array.from(standingsMap.values());
  standings.sort((x, y) => {
    // 0. Withdrawn teams always sort to bottom
    if (x.withdrawn !== y.withdrawn) return x.withdrawn ? 1 : -1;

    // 1. Sets won (descending)
    if (x.sets_won !== y.sets_won) return y.sets_won - x.sets_won;

    // 2. Head-to-head (only for exactly 2-team ties)
    const sameSetsWon = standings.filter((t) => t.sets_won === x.sets_won);
    if (sameSetsWon.length === 2) {
      const h2hKey = `${x.team_id}:${y.team_id}`;
      const h2hWinner = headToHead.get(h2hKey);
      if (h2hWinner === x.team_id) return -1;
      if (h2hWinner === y.team_id) return 1;
    }

    // 3. Point differential (descending)
    if (x.point_differential !== y.point_differential) return y.point_differential - x.point_differential;

    // 4. Points for (descending)
    if (x.points_for !== y.points_for) return y.points_for - x.points_for;

    // 5. Seed (ascending — lower seed wins)
    return x.seed_in_pool - y.seed_in_pool;
  });

  return standings;
}
