import { describe, it, expect } from "vitest";
import { generateBracket } from "../bracket-generation";
import type { OverallTeamStanding } from "../tournament-standings";

function makeTeam(rank: number, pool = "A"): OverallTeamStanding {
  return {
    team_id: `team-${rank}`,
    team_name: `Team ${rank}`,
    pool_id: `pool-${pool}`,
    pool_label: pool,
    pool_rank: rank,
    matches_won: 0,
    matches_lost: 0,
    sets_won: 0,
    sets_lost: 0,
    set_win_pct: 0,
    points_for: 0,
    points_against: 0,
    point_differential: 0,
    point_pct: 0,
    overall_rank: rank,
  };
}

function r1SlotFor(bracket: ReturnType<typeof generateBracket>, teamId: string): number {
  const slot = bracket.slots.find((s) => s.round_number === 1 && s.team_id === teamId);
  if (!slot) throw new Error(`${teamId} not found in R1 slots`);
  return slot.slot_position;
}

describe("generateBracket – seeding", () => {
  it("places 4 teams in standard order [1,4,2,3]", () => {
    const bracket = generateBracket([1, 2, 3, 4].map((r) => makeTeam(r)), "gold", 15, [1]);
    expect(r1SlotFor(bracket, "team-1")).toBe(1);
    expect(r1SlotFor(bracket, "team-4")).toBe(2);
    expect(r1SlotFor(bracket, "team-2")).toBe(3);
    expect(r1SlotFor(bracket, "team-3")).toBe(4);
  });

  it("places 8 teams in standard order [1,8,4,5,2,7,3,6]", () => {
    const bracket = generateBracket([1, 2, 3, 4, 5, 6, 7, 8].map((r) => makeTeam(r)), "gold", 15, [1]);
    expect(r1SlotFor(bracket, "team-1")).toBe(1);
    expect(r1SlotFor(bracket, "team-8")).toBe(2);
    expect(r1SlotFor(bracket, "team-4")).toBe(3);
    expect(r1SlotFor(bracket, "team-5")).toBe(4);
    expect(r1SlotFor(bracket, "team-2")).toBe(5);
    expect(r1SlotFor(bracket, "team-7")).toBe(6);
    expect(r1SlotFor(bracket, "team-3")).toBe(7);
    expect(r1SlotFor(bracket, "team-6")).toBe(8);
  });

  it("produces identical seeding regardless of input array order", () => {
    const sorted   = [1, 2, 3, 4].map((r) => makeTeam(r));
    const shuffled = [3, 1, 4, 2].map((r) => makeTeam(r));

    const bSorted   = generateBracket(sorted,   "gold", 15, [1]);
    const bShuffled = generateBracket(shuffled, "gold", 15, [1]);

    for (let rank = 1; rank <= 4; rank++) {
      expect(r1SlotFor(bSorted, `team-${rank}`)).toBe(r1SlotFor(bShuffled, `team-${rank}`));
    }
  });

  it("does not mutate the input array", () => {
    const teams = [3, 1, 4, 2].map((r) => makeTeam(r));
    const before = teams.map((t) => t.team_id);
    generateBracket(teams, "gold", 15, [1]);
    expect(teams.map((t) => t.team_id)).toEqual(before);
  });
});

describe("generateBracket – matchups", () => {
  it("pairs seed 1 vs seed 4 and seed 2 vs seed 3 in R1 (4-team bracket)", () => {
    const bracket = generateBracket([1, 2, 3, 4].map((r) => makeTeam(r)), "gold", 15, [1]);
    const r1 = bracket.matches.filter((m) => m.round_number === 1);

    const ids = (m: (typeof r1)[number]) => new Set([m.team_a_id, m.team_b_id]);
    expect(r1.some((m) => ids(m).has("team-1") && ids(m).has("team-4"))).toBe(true);
    expect(r1.some((m) => ids(m).has("team-2") && ids(m).has("team-3"))).toBe(true);
  });
});

describe("generateBracket – byes", () => {
  it("fills bracket to next power-of-2 with byes for lowest seeds", () => {
    const bracket = generateBracket([1, 2, 3, 4, 5].map((r) => makeTeam(r)), "gold", 15, [1]);
    const r1 = bracket.slots.filter((s) => s.round_number === 1);

    expect(r1).toHaveLength(8);
    expect(r1.filter((s) => s.is_bye)).toHaveLength(3);
    expect(r1.filter((s) => !s.is_bye)).toHaveLength(5);
  });

  it("pre-populates R2 slots for bye teams", () => {
    const bracket = generateBracket([1, 2, 3, 4, 5].map((r) => makeTeam(r)), "gold", 15, [1]);
    const r2 = bracket.slots.filter((s) => s.round_number === 2);
    expect(r2.some((s) => s.team_id !== null)).toBe(true);
  });

  it("returns empty bracket for fewer than 2 teams", () => {
    const bracket = generateBracket([makeTeam(1)], "gold", 15, [1]);
    expect(bracket.slots).toHaveLength(0);
    expect(bracket.matches).toHaveLength(0);
  });

  it("awards byes to the top overall seeds", () => {
    // 5 distinct-pool teams in a size-8 bracket → 3 byes, to seeds 1, 2, 3.
    const teams = [1, 2, 3, 4, 5].map((r) => makeTeam(r, `P${r}`));
    const bracket = generateBracket(teams, "gold", 15, [1]);

    const byeTeamIds = new Set<string>();
    for (const team of teams) {
      if (hasBye(bracket, team.team_id)) byeTeamIds.add(team.team_id);
    }
    expect(byeTeamIds).toEqual(new Set(["team-1", "team-2", "team-3"]));
  });
});

/* ── Pool-separation seeding ── */

const BRACKET_SIZE_8 = 8;

/** Round at which the two R1 slots would meet (1 = R1, 2 = semis, 3 = final for size 8). */
function meetRound(slotA: number, slotB: number, bracketSize: number): number {
  let a = slotA - 1;
  let b = slotB - 1;
  let round = 0;
  while (a !== b) {
    a = Math.floor(a / 2);
    b = Math.floor(b / 2);
    round++;
  }
  return round;
}

function r1SlotOf(bracket: ReturnType<typeof generateBracket>, teamId: string): number {
  return r1SlotFor(bracket, teamId);
}

/** True if the team's R1 opponent slot is a bye. */
function hasBye(bracket: ReturnType<typeof generateBracket>, teamId: string): boolean {
  const slot = r1SlotFor(bracket, teamId);
  const partnerPos = slot % 2 === 1 ? slot + 1 : slot - 1;
  const partner = bracket.slots.find(
    (s) => s.round_number === 1 && s.slot_position === partnerPos,
  );
  return !!partner?.is_bye;
}

describe("generateBracket – pool separation", () => {
  it("places each pool's two teams in opposite halves (2 per pool)", () => {
    // 4 pools, 2 teams each. Pool D holds the tier boundary (ranks 4 & 5) —
    // the exact pairing standard seeding used to rematch in round 1.
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "C"), makeTeam(4, "D"),
      makeTeam(5, "D"), makeTeam(6, "C"), makeTeam(7, "B"), makeTeam(8, "A"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1, 2]);

    for (const pool of ["A", "B", "C", "D"]) {
      const [a, b] = teams.filter((t) => t.pool_label === pool);
      const slotA = r1SlotOf(bracket, a.team_id);
      const slotB = r1SlotOf(bracket, b.team_id);
      // Opposite halves of a size-8 bracket ⇒ can only meet in the final.
      expect(meetRound(slotA, slotB, BRACKET_SIZE_8)).toBe(3);
    }
  });

  it("never pairs two same-pool teams in round 1, including the tier boundary", () => {
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "C"), makeTeam(4, "D"),
      makeTeam(5, "D"), makeTeam(6, "C"), makeTeam(7, "B"), makeTeam(8, "A"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1, 2]);
    const byId = new Map(teams.map((t) => [t.team_id, t.pool_label]));

    for (const m of bracket.matches.filter((mm) => mm.round_number === 1)) {
      if (m.team_a_id && m.team_b_id) {
        expect(byId.get(m.team_a_id)).not.toBe(byId.get(m.team_b_id));
      }
    }
  });

  it("separates three same-pool teams into different quarters (meet no earlier than semis)", () => {
    // Ranks 3, 4, 5 share pool X; the rest are distinct pools.
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "X"), makeTeam(4, "X"),
      makeTeam(5, "X"), makeTeam(6, "C"), makeTeam(7, "D"), makeTeam(8, "E"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1, 2]);
    const xTeams = teams.filter((t) => t.pool_label === "X");

    const meetRounds: number[] = [];
    for (let i = 0; i < xTeams.length; i++) {
      for (let j = i + 1; j < xTeams.length; j++) {
        meetRounds.push(
          meetRound(r1SlotOf(bracket, xTeams[i].team_id), r1SlotOf(bracket, xTeams[j].team_id), BRACKET_SIZE_8),
        );
      }
    }
    // No same-pool pair meets in round 1; at least one pair separated to the final.
    expect(Math.min(...meetRounds)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...meetRounds)).toBe(3);
  });
});
