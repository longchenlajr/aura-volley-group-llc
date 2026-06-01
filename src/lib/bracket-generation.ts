import type { OverallTeamStanding } from "./tournament-standings";

export interface GeneratedSlot {
  round_number: number;
  slot_position: number;
  team_id: string | null;
  is_bye: boolean;
}

export interface GeneratedBracketMatch {
  round_number: number;
  match_position: number;
  slot_a_position: number;
  slot_b_position: number;
  court_number: number;
  match_order: number;
  team_a_id: string | null;
  team_b_id: string | null;
  work_team_id: string | null;
}

export interface GeneratedBracket {
  bracket_type: "gold" | "silver";
  points_per_set: number;
  slots: GeneratedSlot[];
  matches: GeneratedBracketMatch[];
}

/**
 * Generate a single-elimination bracket with court and work-team assignments.
 *
 * Court assignment:
 * - Each bracket receives a set of court numbers (e.g. [1,2] for gold, [3,4] for silver)
 * - R1 matches are paired on courts so both sides of the bracket stay on the same court
 *   (winners of Game 1 and Game 2 on Court X meet in the next round on Court X)
 * - Courts consolidate in later rounds
 *
 * Work team assignment (R1):
 * - If a team has a bye, they work the R1 game that feeds into their R2 matchup
 * - Otherwise: the lower seed of the two teams playing the next game on that court
 *
 * Work team assignment (R2+):
 * - Handled post-match via assign_bracket_work_team() RPC (loser works next game on same court)
 */
export function generateBracket(
  teams: OverallTeamStanding[],
  bracketType: "gold" | "silver",
  pointsPerSet: 11 | 15,
  courts: number[],
  matchOrderOffset: number = 0,
): GeneratedBracket {
  const n = teams.length;
  if (n < 2) {
    return { bracket_type: bracketType, points_per_set: pointsPerSet, slots: [], matches: [] };
  }

  // Sort by overall_rank so seeding is correct regardless of input array order
  const sorted = [...teams].sort((a, b) => a.overall_rank - b.overall_rank);

  const bracketSize = nextPowerOf2(n);
  const totalRounds = Math.log2(bracketSize);

  // --- Seed teams into bracket positions with pool separation ---
  const seeded = seedWithPoolSeparation(sorted, bracketSize);

  // --- Create round 1 slots ---
  const slots: GeneratedSlot[] = [];
  for (let i = 0; i < bracketSize; i++) {
    const team = seeded[i];
    slots.push({
      round_number: 1,
      slot_position: i + 1,
      team_id: team?.team_id ?? null,
      is_bye: team === null,
    });
  }

  // --- Create later round slots (empty, filled by winners) ---
  let slotsInRound = bracketSize;
  for (let round = 2; round <= totalRounds; round++) {
    slotsInRound /= 2;
    for (let i = 0; i < slotsInRound; i++) {
      slots.push({
        round_number: round,
        slot_position: i + 1,
        team_id: null,
        is_bye: false,
      });
    }
  }

  // --- Identify R1 matchups and handle byes ---
  const r1Slots = slots.filter((s) => s.round_number === 1);
  const r1Matchups: Array<{
    position: number;
    slotA: GeneratedSlot;
    slotB: GeneratedSlot;
    isBye: boolean;
    byeAdvancingTeam: string | null;
  }> = [];

  for (let i = 0; i < r1Slots.length / 2; i++) {
    const slotA = r1Slots[i * 2];
    const slotB = r1Slots[i * 2 + 1];
    const isBye = slotA.is_bye || slotB.is_bye;
    let byeAdvancingTeam: string | null = null;

    if (isBye) {
      byeAdvancingTeam = slotA.is_bye ? slotB.team_id : slotA.team_id;
      // Pre-populate next round slot
      const nextSlot = slots.find(
        (s) => s.round_number === 2 && s.slot_position === i + 1,
      );
      if (nextSlot && byeAdvancingTeam) {
        nextSlot.team_id = byeAdvancingTeam;
      }
    }

    r1Matchups.push({ position: i + 1, slotA, slotB, isBye, byeAdvancingTeam });
  }

  const realR1Games = r1Matchups.filter((m) => !m.isBye);

  // --- Map R1 games to courts ---
  // Initial assignment: pair games that feed into the same R2 match on the same court.
  // R2 match at position P is fed by R1 matchups at positions (P*2-1) and (P*2).
  // Court index = floor((matchup_position - 1) / 2) mod courtCount.
  // This keeps a side of the bracket on one court when the bracket is full.

  const courtCount = courts.length;

  const gamesPerCourt = new Map<number, typeof realR1Games>();
  for (const game of realR1Games) {
    const courtIdx = Math.floor((game.position - 1) / 2) % courtCount;
    const court = courts[courtIdx];
    if (!gamesPerCourt.has(court)) gamesPerCourt.set(court, []);
    gamesPerCourt.get(court)!.push(game);
  }

  // Redistribute: when byes cause games to cluster on fewer courts than
  // available, spread them evenly so courts are used in parallel.
  // E.g. 2 play-in games with 2 courts should go on different courts.
  if (courtCount > 1 && realR1Games.length > 1) {
    const usedCourts = courts.filter((c) => (gamesPerCourt.get(c)?.length ?? 0) > 0);
    const emptyCourts = courts.filter((c) => !(gamesPerCourt.get(c)?.length));
    if (emptyCourts.length > 0) {
      // Collect all games in bracket-position order, then deal them round-robin
      const allGames: typeof realR1Games = [];
      for (const court of courts) {
        allGames.push(...(gamesPerCourt.get(court) ?? []));
      }
      allGames.sort((a, b) => a.position - b.position);

      // Clear and redistribute
      for (const court of courts) gamesPerCourt.set(court, []);
      for (let i = 0; i < allGames.length; i++) {
        const court = courts[i % courtCount];
        gamesPerCourt.get(court)!.push(allGames[i]);
      }
    }
  }

  // --- Determine bye teams and which R1 game feeds into them ---
  // A bye team with position P will play the winner of R1 position P' where P and P'
  // are paired: if P is odd, P' = P+1; if P is even, P' = P-1
  // (positions 1&2 feed R2 pos 1, positions 3&4 feed R2 pos 2, etc.)
  const byeTeamWorkAssignments = new Map<number, string>(); // R1 game position → bye team_id
  for (const matchup of r1Matchups) {
    if (!matchup.isBye || !matchup.byeAdvancingTeam) continue;
    // Find the paired R1 game
    const pairedPos = matchup.position % 2 === 1
      ? matchup.position + 1
      : matchup.position - 1;
    const pairedGame = realR1Games.find((g) => g.position === pairedPos);
    if (pairedGame) {
      byeTeamWorkAssignments.set(pairedGame.position, matchup.byeAdvancingTeam);
    }
  }

  // --- Build match list with court, order, and work team ---
  // First, resolve work teams for each R1 game (keyed by game position)
  const r1WorkTeams = new Map<number, string | null>();
  for (const court of courts) {
    const courtGames = gamesPerCourt.get(court) ?? [];
    for (let gi = 0; gi < courtGames.length; gi++) {
      const game = courtGames[gi];
      const byeWorker = byeTeamWorkAssignments.get(game.position);
      let workTeamId: string | null = byeWorker ?? null;
      if (!workTeamId && gi + 1 < courtGames.length) {
        const nextGame = courtGames[gi + 1];
        const nextTeamA = nextGame.slotA.team_id ? sorted.find((t) => t.team_id === nextGame.slotA.team_id) : null;
        const nextTeamB = nextGame.slotB.team_id ? sorted.find((t) => t.team_id === nextGame.slotB.team_id) : null;
        if (nextTeamA && nextTeamB) {
          workTeamId = nextTeamA.overall_rank > nextTeamB.overall_rank
            ? nextTeamA.team_id
            : nextTeamB.team_id;
        }
      }
      r1WorkTeams.set(game.position, workTeamId);
    }
  }

  // Build per-court game queues (preserving within-court order)
  const courtQueues = new Map<number, typeof realR1Games>();
  for (const court of courts) {
    courtQueues.set(court, [...(gamesPerCourt.get(court) ?? [])]);
  }

  // Interleave R1 games across courts: round-robin one game from each court
  // so consecutive match_orders use different courts (parallel play).
  const matches: GeneratedBracketMatch[] = [];
  let matchOrder = matchOrderOffset + 1;

  const activeCourtsR1 = courts.filter((c) => (courtQueues.get(c)?.length ?? 0) > 0);
  let placed = 0;
  const totalR1 = realR1Games.length;
  while (placed < totalR1) {
    for (const court of activeCourtsR1) {
      const queue = courtQueues.get(court)!;
      if (queue.length === 0) continue;
      const game = queue.shift()!;
      matches.push({
        round_number: 1,
        match_position: game.position,
        slot_a_position: game.slotA.slot_position,
        slot_b_position: game.slotB.slot_position,
        court_number: court,
        match_order: matchOrder++,
        team_a_id: game.slotA.team_id,
        team_b_id: game.slotB.team_id,
        work_team_id: r1WorkTeams.get(game.position) ?? null,
      });
      placed++;
    }
  }

  // Process R2+ matches
  // Courts consolidate: only use as many courts as there are real matches in each round.
  // Interleave across courts so match_order reflects parallel play.
  let activeCourts = [...courts];
  for (let round = 2; round <= totalRounds; round++) {
    const roundSlots = slots.filter((s) => s.round_number === round);

    // Count real matches (non-bye) first to determine court usage
    const realMatches: Array<{ index: number; slotA: GeneratedSlot; slotB: GeneratedSlot }> = [];
    for (let i = 0; i < roundSlots.length / 2; i++) {
      const slotA = roundSlots[i * 2];
      const slotB = roundSlots[i * 2 + 1];
      if (slotA.is_bye && slotB.is_bye) continue;
      if (slotA.is_bye || slotB.is_bye) {
        // Bye in later round — auto-advance
        const advancer = slotA.is_bye ? slotB.team_id : slotA.team_id;
        const nextSlot = slots.find(
          (s) => s.round_number === round + 1 && s.slot_position === i + 1,
        );
        if (nextSlot && advancer) nextSlot.team_id = advancer;
        continue;
      }
      realMatches.push({ index: i, slotA, slotB });
    }

    // Consolidate: use min(activeCourts, realMatchCount) courts
    if (realMatches.length < activeCourts.length) {
      activeCourts = activeCourts.slice(0, Math.max(1, realMatches.length));
    }

    // Assign courts to matches, then interleave by court
    const roundMatchesWithCourt = realMatches.map((rm, mi) => ({
      ...rm,
      court: activeCourts[mi % activeCourts.length],
    }));

    // Group by court, then round-robin across courts
    const roundCourtQueues = new Map<number, typeof roundMatchesWithCourt>();
    for (const rm of roundMatchesWithCourt) {
      if (!roundCourtQueues.has(rm.court)) roundCourtQueues.set(rm.court, []);
      roundCourtQueues.get(rm.court)!.push(rm);
    }
    const roundActiveCourts = activeCourts.filter(
      (c) => (roundCourtQueues.get(c)?.length ?? 0) > 0,
    );

    let roundPlaced = 0;
    while (roundPlaced < realMatches.length) {
      for (const court of roundActiveCourts) {
        const queue = roundCourtQueues.get(court)!;
        if (queue.length === 0) continue;
        const rm = queue.shift()!;

        matches.push({
          round_number: round,
          match_position: rm.index + 1,
          slot_a_position: rm.slotA.slot_position,
          slot_b_position: rm.slotB.slot_position,
          court_number: rm.court,
          match_order: matchOrder++,
          team_a_id: rm.slotA.team_id,
          team_b_id: rm.slotB.team_id,
          work_team_id: null,
        });
        roundPlaced++;
      }
    }
  }

  return {
    bracket_type: bracketType,
    points_per_set: pointsPerSet,
    slots,
    matches,
  };
}

/**
 * Count R1 real games (non-bye) for a given team count.
 */
export function countR1Games(teamCount: number): number {
  const bracketSize = nextPowerOf2(teamCount);
  const byeCount = bracketSize - teamCount;
  return bracketSize / 2 - byeCount;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Pool-separated bracket seeding (separation-first).
 *
 * Teams (sorted strongest-first by overall_rank) are placed into bracket slots
 * by recursive bisection: at each region the field splits into a top and bottom
 * half, and teams are dealt into the two halves with this priority:
 *   1. Capacity — a half cannot exceed its slot count.
 *   2. Separation — if one half already holds a team from the same pool and the
 *      other does not, the team goes to the half WITHOUT the pool-mate. This
 *      pushes pool-mates apart at the highest level possible (halves, then
 *      quarters, then eighths) so they meet as late as possible.
 *   3. Seed balance — otherwise follow the standard single-elim snake pattern,
 *      keeping the halves strength-balanced and top seeds advantaged.
 *
 * Byes are the weakest entries (null) and never trigger separation, so the
 * snake pattern pairs them with the top overall seeds — i.e. top seeds get the
 * byes, exactly as in standard seeding.
 *
 * When pools are all distinct (or all identical) no separation is triggered and
 * the result is identical to standard bracket seed order.
 */
function seedWithPoolSeparation(
  teams: OverallTeamStanding[],
  bracketSize: number,
): (OverallTeamStanding | null)[] {
  // Pad to bracket size with byes (null) as the weakest entries.
  const entries: (OverallTeamStanding | null)[] = [];
  for (let i = 0; i < bracketSize; i++) entries.push(teams[i] ?? null);

  const slots: (OverallTeamStanding | null)[] = new Array(bracketSize).fill(null);
  placeRegion(entries, 0, bracketSize, slots);
  return slots;
}

/**
 * Recursively place a region's entries (sorted strongest-first) into its slots,
 * splitting into top/bottom halves with the separation-first rules above.
 */
function placeRegion(
  entries: (OverallTeamStanding | null)[],
  slotStart: number,
  regionSize: number,
  slots: (OverallTeamStanding | null)[],
): void {
  if (regionSize === 1) {
    slots[slotStart] = entries[0] ?? null;
    return;
  }

  const half = regionSize / 2;
  const pattern = standardSidePattern(regionSize); // true = top half
  const top: (OverallTeamStanding | null)[] = [];
  const bottom: (OverallTeamStanding | null)[] = [];

  entries.forEach((entry, j) => {
    if (top.length >= half) { bottom.push(entry); return; }
    if (bottom.length >= half) { top.push(entry); return; }

    const pool = entry?.pool_label ?? null;
    if (pool) {
      const topHas = top.some((t) => t?.pool_label === pool);
      const botHas = bottom.some((t) => t?.pool_label === pool);
      if (topHas && !botHas) { bottom.push(entry); return; }
      if (botHas && !topHas) { top.push(entry); return; }
    }

    if (pattern[j]) top.push(entry);
    else bottom.push(entry);
  });

  placeRegion(top, slotStart, half, slots);
  placeRegion(bottom, slotStart + half, half, slots);
}

/**
 * For a region of the given size, return the standard single-elim side pattern:
 * pattern[j] is true if the j-th strongest entry (seed j+1) belongs in the top
 * half under standard seeding. Derived from bracketSeedOrder so it stays in sync.
 */
function standardSidePattern(size: number): boolean[] {
  const order = bracketSeedOrder(size); // order[slot] = seed
  const slotOfSeed = new Array<number>(size);
  order.forEach((seed, slot) => {
    slotOfSeed[seed - 1] = slot;
  });
  const half = size / 2;
  return slotOfSeed.map((slot) => slot < half);
}

/**
 * Standard bracket seeding order (recursive).
 * E.g. size 4 → [1, 4, 2, 3], size 8 → [1, 8, 4, 5, 2, 7, 3, 6]
 */
function bracketSeedOrder(size: number): number[] {
  if (size === 1) return [1];
  const prev = bracketSeedOrder(size / 2);
  const result: number[] = [];
  for (const seed of prev) {
    result.push(seed);
    result.push(size + 1 - seed);
  }
  return result;
}

/**
 * Get round label for display.
 */
export function getRoundLabel(roundNumber: number, totalRounds: number): string {
  if (roundNumber === totalRounds) return "Final";
  if (roundNumber === totalRounds - 1) return "Semifinals";
  if (roundNumber === totalRounds - 2) return "Quarterfinals";
  return `Round ${roundNumber}`;
}
