import type { PoolStandings } from "./standings";

export interface OverallTeamStanding {
  team_id: string;
  team_name: string;
  pool_id: string;
  pool_label: string;
  pool_rank: number;
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  points_for: number;
  points_against: number;
  point_differential: number;
  overall_rank: number;
}

/**
 * Compute overall tournament standings from pool standings.
 * All pool 1st-place finishers rank above all 2nd-place, etc.
 * Within same pool-rank tier: sets won → point diff → points for.
 */
export function computeOverallStandings(
  pools: PoolStandings[],
): OverallTeamStanding[] {
  // Flatten all teams with their pool rank
  const allTeams: Array<Omit<OverallTeamStanding, "overall_rank">> = [];

  for (const pool of pools) {
    pool.standings.forEach((t, idx) => {
      allTeams.push({
        team_id: t.team_id,
        team_name: t.team_name,
        pool_id: pool.pool_id,
        pool_label: pool.pool_label,
        pool_rank: idx + 1,
        matches_won: t.matches_won,
        matches_lost: t.matches_lost,
        sets_won: t.sets_won,
        sets_lost: t.sets_lost,
        points_for: t.points_for,
        points_against: t.points_against,
        point_differential: t.point_differential,
      });
    });
  }

  // Sort: pool_rank first, then tiebreakers within same rank tier
  allTeams.sort((a, b) => {
    if (a.pool_rank !== b.pool_rank) return a.pool_rank - b.pool_rank;
    if (a.sets_won !== b.sets_won) return b.sets_won - a.sets_won;
    if (a.point_differential !== b.point_differential) return b.point_differential - a.point_differential;
    if (a.points_for !== b.points_for) return b.points_for - a.points_for;
    return 0;
  });

  // Assign overall rank
  return allTeams.map((t, i) => ({ ...t, overall_rank: i + 1 }));
}

/**
 * Get default cutoff: top 2 per pool go to gold (or adjust for power-of-2 brackets).
 */
export function getDefaultGoldCutoff(
  standings: OverallTeamStanding[],
  poolCount: number,
): number {
  // Default: top 2 from each pool
  const defaultCut = poolCount * 2;
  // But prefer power-of-2 bracket if close
  const total = standings.length;
  if (total <= 4) return Math.min(defaultCut, total);

  // If default cutoff is within 2 of a power of 2, snap to it
  const pow2s = [4, 8, 16];
  for (const p of pow2s) {
    if (Math.abs(defaultCut - p) <= 1 && p <= total) return p;
  }

  return Math.min(defaultCut, total);
}
