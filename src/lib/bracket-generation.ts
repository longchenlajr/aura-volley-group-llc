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

  const bracketSize = nextPowerOf2(n);
  const totalRounds = Math.log2(bracketSize);

  // --- Seed teams into bracket positions with pool separation ---
  const seeded = seedWithPoolSeparation(teams, bracketSize);

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
  // Pair games that feed into the same R2 match on the same court.
  // R2 match at position P is fed by R1 matchups at positions (P*2-1) and (P*2).
  // So court assignment: games at positions [1,2] share a court, [3,4] share a court, etc.
  // This keeps a side of the bracket on one court.

  const courtCount = courts.length;

  // Group real R1 games by which court they should be on
  // Court index = floor((matchup_position - 1) / 2) mod courtCount
  const gamesPerCourt = new Map<number, typeof realR1Games>();
  for (const game of realR1Games) {
    const courtIdx = Math.floor((game.position - 1) / 2) % courtCount;
    const court = courts[courtIdx];
    if (!gamesPerCourt.has(court)) gamesPerCourt.set(court, []);
    gamesPerCourt.get(court)!.push(game);
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
  const matches: GeneratedBracketMatch[] = [];
  let matchOrder = matchOrderOffset + 1;

  // Process R1 games court by court
  for (const court of courts) {
    const courtGames = gamesPerCourt.get(court) ?? [];
    for (let gi = 0; gi < courtGames.length; gi++) {
      const game = courtGames[gi];

      // Work team for this game:
      // 1. If a bye team feeds into this game's R2 opponent, that bye team works
      const byeWorker = byeTeamWorkAssignments.get(game.position);

      // 2. Otherwise: lower seed of the next game on this court
      let workTeamId: string | null = byeWorker ?? null;
      if (!workTeamId && gi + 1 < courtGames.length) {
        const nextGame = courtGames[gi + 1];
        // Lower seed = higher overall_rank number
        const nextTeamA = nextGame.slotA.team_id ? teams.find((t) => t.team_id === nextGame.slotA.team_id) : null;
        const nextTeamB = nextGame.slotB.team_id ? teams.find((t) => t.team_id === nextGame.slotB.team_id) : null;
        if (nextTeamA && nextTeamB) {
          workTeamId = nextTeamA.overall_rank > nextTeamB.overall_rank
            ? nextTeamA.team_id
            : nextTeamB.team_id;
        }
      }

      matches.push({
        round_number: 1,
        match_position: game.position,
        slot_a_position: game.slotA.slot_position,
        slot_b_position: game.slotB.slot_position,
        court_number: court,
        match_order: matchOrder++,
        team_a_id: game.slotA.team_id,
        team_b_id: game.slotB.team_id,
        work_team_id: workTeamId,
      });
    }
  }

  // Process R2+ matches
  // Courts consolidate: only use as many courts as there are real matches in each round
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

    for (let mi = 0; mi < realMatches.length; mi++) {
      const { index: i, slotA, slotB } = realMatches[mi];
      const court = activeCourts[mi % activeCourts.length];

      // R2+ work teams are assigned dynamically after the match completes
      // (loser of previous game on same court — handled by assign_bracket_work_team RPC)
      matches.push({
        round_number: round,
        match_position: i + 1,
        slot_a_position: slotA.slot_position,
        slot_b_position: slotB.slot_position,
        court_number: court,
        match_order: matchOrder++,
        team_a_id: slotA.team_id,
        team_b_id: slotB.team_id,
        work_team_id: null,
      });
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
 * Standard bracket seeding across the full bracket.
 * Seed 1 at top, seed 2 at bottom half — always on opposite sides.
 * Byes go to positions of the highest seed numbers (i.e. top seeds get byes).
 */
function seedWithPoolSeparation(
  teams: OverallTeamStanding[],
  bracketSize: number,
): (OverallTeamStanding | null)[] {
  const order = bracketSeedOrder(bracketSize);
  const slots: (OverallTeamStanding | null)[] = new Array(bracketSize).fill(null);

  for (let pos = 0; pos < bracketSize; pos++) {
    const seedIdx = order[pos] - 1;
    if (seedIdx < teams.length) {
      slots[pos] = teams[seedIdx];
    }
  }

  return slots;
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
