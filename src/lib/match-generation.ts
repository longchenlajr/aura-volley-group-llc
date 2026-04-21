export interface MatchGenerationInput {
  pool_id: string;
  court_number: number;
  teams: Array<{
    team_id: string;
    seed_in_pool: number;
  }>;
}

export interface GeneratedMatch {
  match_order: number;
  team_a_id: string;
  team_b_id: string;
  work_team_id: string | null;
  court_number: number;
}

// Hardcoded schedules from tournament director
// Format: [team_a_seed, team_b_seed, work_team_seed]
// Team seeds are 1-indexed (seed_in_pool)

const SCHEDULE_4: [number, number, number][] = [
  [2, 3, 4],
  [1, 4, 3],
  [2, 4, 1],
  [1, 3, 4],
  [3, 4, 2],
  [1, 2, 3],
];

const SCHEDULE_5: [number, number, number][] = [
  [2, 5, 3],
  [1, 4, 2],
  [3, 5, 1],
  [2, 4, 5],
  [1, 3, 4],
  [4, 5, 1],
  [2, 3, 4],
  [1, 5, 2],
  [3, 4, 5],
  [1, 2, 3],
];

// 6-team pool split across 2 nets (played simultaneously)
// Net 1 (primary court)
const SCHEDULE_6_NET1: [number, number, number][] = [
  [1, 2, 5],
  [5, 6, 2],
  [5, 4, 1],
  [1, 4, 5],
  [5, 1, 4],
  [5, 2, 1],
  [5, 3, 1],
  [1, 6, 3],
];

// Net 2 (primary court + 1)
const SCHEDULE_6_NET2: [number, number, number][] = [
  [3, 4, 6],
  [1, 3, 4],
  [2, 6, 4],
  [2, 3, 6],
  [6, 3, 2],
  [6, 4, 3],
  [2, 4, 6],
];

// 7-team pool split across 2 nets (played simultaneously)
// Net 1 (primary court)
const SCHEDULE_7_NET1: [number, number, number][] = [
  [1, 2, 6],
  [5, 6, 4],
  [5, 4, 7],
  [7, 4, 5],
  [2, 5, 7],
  [2, 7, 4],
  [4, 6, 5],
  [7, 6, 5],
  [5, 3, 7],
  [7, 3, 2],
  [7, 5, 4],
];

// Net 2 (primary court + 1)
const SCHEDULE_7_NET2: [number, number, number][] = [
  [3, 4, 7],
  [7, 1, 3],
  [2, 3, 1],
  [1, 6, 2],
  [3, 6, 1],
  [1, 5, 3],
  [1, 3, 2],
  [2, 4, 3],
  [2, 6, 1],
  [1, 4, 6],
];

/**
 * Generate round-robin matches for a pool using hardcoded tournament director schedules.
 * - 3 teams: trivial round robin
 * - 4-5 teams: single court, optimized schedule
 * - 6-7 teams: split across 2 courts playing simultaneously
 *   (no team is assigned to both courts in the same time slot)
 */
export function generatePoolMatches(input: MatchGenerationInput): GeneratedMatch[] {
  const { court_number, teams } = input;
  const n = teams.length;

  if (n < 2) return [];

  // Sort by seed_in_pool and create ID lookup (1-indexed)
  const sorted = [...teams].sort((a, b) => a.seed_in_pool - b.seed_in_pool);
  const id = (seed: number) => sorted[seed - 1]?.team_id ?? "";

  // 3 teams: trivial
  if (n === 3) {
    return [
      { match_order: 1, team_a_id: id(2), team_b_id: id(3), work_team_id: id(1), court_number },
      { match_order: 2, team_a_id: id(1), team_b_id: id(3), work_team_id: id(2), court_number },
      { match_order: 3, team_a_id: id(1), team_b_id: id(2), work_team_id: id(3), court_number },
    ];
  }

  // 4 teams: single court
  if (n === 4) {
    return SCHEDULE_4.map(([a, b, w], i) => ({
      match_order: i + 1,
      team_a_id: id(a),
      team_b_id: id(b),
      work_team_id: id(w),
      court_number,
    }));
  }

  // 5 teams: single court
  if (n === 5) {
    return SCHEDULE_5.map(([a, b, w], i) => ({
      match_order: i + 1,
      team_a_id: id(a),
      team_b_id: id(b),
      work_team_id: id(w),
      court_number,
    }));
  }

  // 6 teams: 2 courts simultaneously
  if (n === 6) {
    const net1 = SCHEDULE_6_NET1.map(([a, b, w], i) => ({
      match_order: i + 1,
      team_a_id: id(a),
      team_b_id: id(b),
      work_team_id: id(w),
      court_number,
    }));
    const net2 = SCHEDULE_6_NET2.map(([a, b, w], i) => ({
      match_order: i + 1,
      team_a_id: id(a),
      team_b_id: id(b),
      work_team_id: id(w),
      court_number: court_number + 1,
    }));
    return [...net1, ...net2];
  }

  // 7 teams: 2 courts simultaneously
  if (n === 7) {
    const net1 = SCHEDULE_7_NET1.map(([a, b, w], i) => ({
      match_order: i + 1,
      team_a_id: id(a),
      team_b_id: id(b),
      work_team_id: id(w),
      court_number,
    }));
    const net2 = SCHEDULE_7_NET2.map(([a, b, w], i) => ({
      match_order: i + 1,
      team_a_id: id(a),
      team_b_id: id(b),
      work_team_id: id(w),
      court_number: court_number + 1,
    }));
    return [...net1, ...net2];
  }

  // Fallback for unsupported sizes: use circle method
  return generateCircleMethod(input);
}

/**
 * Circle method fallback for pool sizes > 7 (shouldn't normally occur)
 */
function generateCircleMethod(input: MatchGenerationInput): GeneratedMatch[] {
  const { court_number, teams } = input;
  const sorted = [...teams].sort((a, b) => a.seed_in_pool - b.seed_in_pool);
  const ids = sorted.map((t) => t.team_id);
  const n = ids.length;

  const fixed = ids[0];
  const rotating = ids.slice(1);
  const matches: Array<[string, string]> = [];

  for (let round = 0; round < n - 1; round++) {
    matches.push([fixed, rotating[0]]);
    for (let i = 1; i <= (rotating.length - 1) / 2; i++) {
      matches.push([rotating[i], rotating[rotating.length - i]]);
    }
    rotating.unshift(rotating.pop()!);
  }

  return matches.map(([a, b], i) => ({
    match_order: i + 1,
    team_a_id: a,
    team_b_id: b,
    work_team_id: null,
    court_number,
  }));
}

/**
 * Sanity check: verify every team plays every other team exactly once.
 */
export function validateMatches(
  matches: GeneratedMatch[],
  teamIds: string[],
): { valid: boolean; error?: string } {
  const pairSet = new Set<string>();
  for (const m of matches) {
    const key = [m.team_a_id, m.team_b_id].sort().join(":");
    if (pairSet.has(key)) return { valid: false, error: `Duplicate pairing: ${key}` };
    pairSet.add(key);
  }

  const expectedPairs = (teamIds.length * (teamIds.length - 1)) / 2;
  if (pairSet.size !== expectedPairs) {
    return { valid: false, error: `Expected ${expectedPairs} matches, got ${pairSet.size}` };
  }

  return { valid: true };
}
