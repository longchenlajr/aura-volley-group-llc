export interface MatchFormat {
  sets: number;
  pointsPerSet: number;
}

export interface MatchSet {
  set_number: number;
  team_a_score: number;
  team_b_score: number;
  submitted_at?: string;
}

/**
 * Determine match format from pool size.
 * Side-out scoring, win-by-2 in all sets.
 */
export function getMatchFormat(poolSize: number): MatchFormat {
  switch (poolSize) {
    case 3: return { sets: 2, pointsPerSet: 15 };
    case 4: return { sets: 2, pointsPerSet: 15 };
    case 5: return { sets: 2, pointsPerSet: 11 };
    case 6: return { sets: 1, pointsPerSet: 15 };
    case 7: return { sets: 1, pointsPerSet: 11 };
    default: return { sets: 1, pointsPerSet: 15 };
  }
}

/**
 * Check if a single set is complete (side-out scoring, win-by-2).
 */
export function isSetComplete(
  teamAScore: number,
  teamBScore: number,
  pointsPerSet: number,
): boolean {
  const maxScore = Math.max(teamAScore, teamBScore);
  const diff = Math.abs(teamAScore - teamBScore);
  return maxScore >= pointsPerSet && diff >= 2;
}

/**
 * Check if an entire match is complete.
 */
export function isMatchComplete(sets: MatchSet[], format: MatchFormat): boolean {
  if (sets.length === 0) return false;

  // All scheduled sets must have valid scores
  for (let i = 1; i <= format.sets; i++) {
    const set = sets.find((s) => s.set_number === i);
    if (!set) return false;
    if (!isSetComplete(set.team_a_score, set.team_b_score, format.pointsPerSet)) return false;
  }

  return true;
}

/**
 * Determine match winner.
 * Multi-set: check sets won first; if split, cumulative points decides.
 * Single-set: winner of the set.
 */
export function matchWinner(sets: MatchSet[], format: MatchFormat): "team_a" | "team_b" | null {
  if (!isMatchComplete(sets, format)) return null;

  // Single-set match
  if (format.sets === 1) {
    const s = sets.find((s) => s.set_number === 1);
    if (!s) return null;
    return s.team_a_score > s.team_b_score ? "team_a" : "team_b";
  }

  // Multi-set: check sets won
  const setsWonA = sets.filter((s) => s.team_a_score > s.team_b_score).length;
  const setsWonB = sets.filter((s) => s.team_b_score > s.team_a_score).length;

  if (setsWonA !== setsWonB) {
    return setsWonA > setsWonB ? "team_a" : "team_b";
  }

  // Sets split — cumulative points decides
  const totalA = sets.reduce((sum, s) => sum + s.team_a_score, 0);
  const totalB = sets.reduce((sum, s) => sum + s.team_b_score, 0);

  if (totalA === totalB) return null;
  return totalA > totalB ? "team_a" : "team_b";
}

/**
 * Format set scores for display.
 * "15-11, 13-15" or "15-12" for single set.
 * If split, adds cumulative: "15-11, 13-15 · 28-26"
 */
export function formatSetScores(sets: MatchSet[], format: MatchFormat): string {
  const sorted = [...sets].sort((a, b) => a.set_number - b.set_number);
  const parts = sorted.map((s) => `${s.team_a_score}-${s.team_b_score}`);
  const base = parts.join(", ");

  if (format.sets >= 2 && sorted.length >= 2) {
    const setsWonA = sorted.filter((s) => s.team_a_score > s.team_b_score).length;
    const setsWonB = sorted.filter((s) => s.team_b_score > s.team_a_score).length;

    if (setsWonA === setsWonB) {
      const totalA = sorted.reduce((sum, s) => sum + s.team_a_score, 0);
      const totalB = sorted.reduce((sum, s) => sum + s.team_b_score, 0);
      return `${base} · ${totalA}-${totalB}`;
    }
  }

  return base;
}

/**
 * Format description of match format.
 */
export function formatMatchFormat(format: MatchFormat): string {
  if (format.sets === 1) return `1 set to ${format.pointsPerSet}`;
  return `Best of ${format.sets} sets to ${format.pointsPerSet}`;
}

/**
 * Check if a set is within the 10-minute edit window.
 */
export function isSetEditable(submittedAt: string | undefined): boolean {
  if (!submittedAt) return true;
  const submitted = new Date(submittedAt).getTime();
  const now = Date.now();
  return now - submitted < 10 * 60 * 1000;
}

/**
 * Get remaining edit time in seconds.
 */
export function editTimeRemaining(submittedAt: string): number {
  const submitted = new Date(submittedAt).getTime();
  const remaining = (submitted + 10 * 60 * 1000) - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}
