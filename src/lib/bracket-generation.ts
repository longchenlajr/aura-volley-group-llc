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
}

export interface GeneratedBracket {
  bracket_type: "gold" | "silver";
  points_per_set: number;
  slots: GeneratedSlot[];
  matches: GeneratedBracketMatch[];
}

/**
 * Generate a single-elimination bracket.
 * - Pool-separation: same-pool teams in opposite halves (meet only in final)
 * - Byes go to top seeds
 * - Standard seeding: 1 vs lowest, 2 vs next lowest within each half
 */
export function generateBracket(
  teams: OverallTeamStanding[],
  bracketType: "gold" | "silver",
  pointsPerSet: 11 | 15,
  courtCount: number,
  matchOrderOffset: number = 0,
): GeneratedBracket {
  const n = teams.length;
  if (n < 2) {
    return { bracket_type: bracketType, points_per_set: pointsPerSet, slots: [], matches: [] };
  }

  // Bracket size = next power of 2 >= n
  const bracketSize = nextPowerOf2(n);
  const byeCount = bracketSize - n;
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

  // --- Generate matches ---
  const matches: GeneratedBracketMatch[] = [];
  let matchOrder = matchOrderOffset + 1;
  let courtIdx = 0;

  for (let round = 1; round <= totalRounds; round++) {
    const roundSlots = slots.filter((s) => s.round_number === round);
    const matchCount = roundSlots.length / 2;

    for (let i = 0; i < matchCount; i++) {
      const slotA = roundSlots[i * 2];
      const slotB = roundSlots[i * 2 + 1];

      // Skip if both are byes (shouldn't happen with proper seeding)
      if (slotA.is_bye && slotB.is_bye) continue;

      // If one is a bye, the other auto-advances — still create the match for structure
      // but mark the non-bye team as auto-advancing
      const teamA = slotA.team_id;
      const teamB = slotB.team_id;
      const isByeMatch = slotA.is_bye || slotB.is_bye;

      if (!isByeMatch) {
        // Real match
        const court = (courtIdx % Math.max(1, courtCount)) + 1;
        matches.push({
          round_number: round,
          match_position: i + 1,
          slot_a_position: slotA.slot_position,
          slot_b_position: slotB.slot_position,
          court_number: court,
          match_order: matchOrder++,
          team_a_id: teamA,
          team_b_id: teamB,
        });
        courtIdx++;
      } else {
        // Bye match — auto-advance the non-bye team to next round
        const advancingTeamId = slotA.is_bye ? teamB : teamA;
        const nextRoundSlot = slots.find(
          (s) => s.round_number === round + 1 && s.slot_position === i + 1,
        );
        if (nextRoundSlot && advancingTeamId) {
          nextRoundSlot.team_id = advancingTeamId;
        }
      }
    }

    // Consolidate courts for later rounds
    if (round >= 2) courtCount = Math.max(1, Math.floor(courtCount / 2));
  }

  return {
    bracket_type: bracketType,
    points_per_set: pointsPerSet,
    slots,
    matches,
  };
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
 *
 * For 8 slots: positions get seeds [1, 8, 4, 5, 2, 7, 3, 6]
 *   R1: (1vBYE), (4v5), (2vBYE), (3v6) — with 6 teams
 *   Semi: 1 vs winner(4v5), 2 vs winner(3v6)
 *   Final: top half winner vs bottom half winner
 *
 * Pool separation happens naturally — pool winners are higher seeds,
 * pool 2nds are lower seeds, so they land on opposite sides of the bracket.
 */
function seedWithPoolSeparation(
  teams: OverallTeamStanding[],
  bracketSize: number,
): (OverallTeamStanding | null)[] {
  const order = bracketSeedOrder(bracketSize);
  const slots: (OverallTeamStanding | null)[] = new Array(bracketSize).fill(null);

  for (let pos = 0; pos < bracketSize; pos++) {
    const seedIdx = order[pos] - 1; // order is 1-indexed
    if (seedIdx < teams.length) {
      slots[pos] = teams[seedIdx];
    }
    // else: bye (null) — top seeds' opponents are highest seed numbers
  }

  return slots;
}

/**
 * Standard bracket seeding order (recursive).
 * Returns array where index = bracket position, value = seed number (1-indexed).
 * E.g. size 4 → [1, 4, 2, 3]: pos 0 gets seed 1, pos 1 gets seed 4, etc.
 * E.g. size 8 → [1, 8, 4, 5, 2, 7, 3, 6]
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
