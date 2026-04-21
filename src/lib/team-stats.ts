import { matchWinner, getMatchFormat, type MatchFormat } from "./score-format";

export interface TeamStats {
  team_id: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_differential: number;
}

interface MatchInput {
  team_a_id: string;
  team_b_id: string;
  status: string;
  sets: Array<{ team_a_score: number; team_b_score: number }>;
  pool_size: number;
}

/**
 * Compute W-L record and point differential for all teams in a tournament.
 * Only counts completed matches.
 */
export function computeTeamStats(
  teamIds: string[],
  matches: MatchInput[],
): Map<string, TeamStats> {
  const stats = new Map<string, TeamStats>();
  for (const id of teamIds) {
    stats.set(id, { team_id: id, wins: 0, losses: 0, points_for: 0, points_against: 0, point_differential: 0 });
  }

  for (const m of matches) {
    if (m.status !== "complete" || m.sets.length === 0) continue;

    const format = getMatchFormat(m.pool_size);
    const winner = matchWinner(
      m.sets.map((s, i) => ({ set_number: i + 1, ...s })),
      format,
    );

    const a = stats.get(m.team_a_id);
    const b = stats.get(m.team_b_id);

    if (a) {
      if (winner === "team_a") a.wins++;
      else if (winner === "team_b") a.losses++;
      for (const s of m.sets) {
        a.points_for += s.team_a_score;
        a.points_against += s.team_b_score;
      }
      a.point_differential = a.points_for - a.points_against;
    }

    if (b) {
      if (winner === "team_b") b.wins++;
      else if (winner === "team_a") b.losses++;
      for (const s of m.sets) {
        b.points_for += s.team_b_score;
        b.points_against += s.team_a_score;
      }
      b.point_differential = b.points_for - b.points_against;
    }
  }

  return stats;
}
