import { describe, it, expect } from "vitest";
import { generateBracket, splitCourts } from "../bracket-generation";
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

/* ── Bye-seeding regression (issue #10) ──
 * Pool separation can shuffle real teams between halves, which changes how many
 * byes land in each half — handing a bye to a lower-ranked team while a
 * higher-ranked team plays a Round-1 game. These tests pin the guarantee that
 * byes always go to the top `byeCount` teams by overall_rank.
 */

const BRACKET_SIZE_16 = 16;

describe("generateBracket – bye seeding guarantee (issue #10)", () => {
  it("awards byes to exactly the top 5 ranked teams in a mixed 4/4/3 pool field", () => {
    // pools of 4, 4, 3 = 11 teams, bracketSize 16, byeCount 5.
    // Ranks: 1:A1 2:B1 3:C1 4:A2 5:B2 6:C2 7:A3 8:B3 9:C3 10:A4 11:B4
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "C"), makeTeam(4, "A"),
      makeTeam(5, "B"), makeTeam(6, "C"), makeTeam(7, "A"), makeTeam(8, "B"),
      makeTeam(9, "C"), makeTeam(10, "A"), makeTeam(11, "B"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1]);

    const byeTeamIds = new Set<string>();
    for (const team of teams) {
      if (hasBye(bracket, team.team_id)) byeTeamIds.add(team.team_id);
    }
    expect(byeTeamIds).toEqual(
      new Set(["team-1", "team-2", "team-3", "team-4", "team-5"]),
    );
  });

  it("never pairs two same-pool teams in round 1 for the 4/4/3 field", () => {
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "C"), makeTeam(4, "A"),
      makeTeam(5, "B"), makeTeam(6, "C"), makeTeam(7, "A"), makeTeam(8, "B"),
      makeTeam(9, "C"), makeTeam(10, "A"), makeTeam(11, "B"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1]);
    const byId = new Map(teams.map((t) => [t.team_id, t.pool_label]));

    for (const m of bracket.matches.filter((mm) => mm.round_number === 1)) {
      if (m.team_a_id && m.team_b_id) {
        expect(byId.get(m.team_a_id)).not.toBe(byId.get(m.team_b_id));
      }
    }
  });

  it("keeps every pool's earliest same-pool meeting at round 3 (semis) for the 4/4/3 field", () => {
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "C"), makeTeam(4, "A"),
      makeTeam(5, "B"), makeTeam(6, "C"), makeTeam(7, "A"), makeTeam(8, "B"),
      makeTeam(9, "C"), makeTeam(10, "A"), makeTeam(11, "B"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1]);

    for (const pool of ["A", "B", "C"]) {
      const poolTeams = teams.filter((t) => t.pool_label === pool);
      const meetRounds: number[] = [];
      for (let i = 0; i < poolTeams.length; i++) {
        for (let j = i + 1; j < poolTeams.length; j++) {
          meetRounds.push(
            meetRound(
              r1SlotOf(bracket, poolTeams[i].team_id),
              r1SlotOf(bracket, poolTeams[j].team_id),
              BRACKET_SIZE_16,
            ),
          );
        }
      }
      expect(Math.min(...meetRounds)).toBe(3);
    }
  });

  it("awards byes to the top-ranked teams and keeps R1 pool-separated for a lopsided 6+5 field", () => {
    // pools of 6, 5 = 11 teams, bracketSize 16, byeCount 5.
    const teams = [
      makeTeam(1, "A"), makeTeam(2, "B"), makeTeam(3, "A"), makeTeam(4, "B"),
      makeTeam(5, "A"), makeTeam(6, "B"), makeTeam(7, "A"), makeTeam(8, "B"),
      makeTeam(9, "A"), makeTeam(10, "B"), makeTeam(11, "A"),
    ];
    const bracket = generateBracket(teams, "gold", 15, [1]);

    const byeTeamIds = new Set<string>();
    for (const team of teams) {
      if (hasBye(bracket, team.team_id)) byeTeamIds.add(team.team_id);
    }
    expect(byeTeamIds).toEqual(
      new Set(["team-1", "team-2", "team-3", "team-4", "team-5"]),
    );

    const byId = new Map(teams.map((t) => [t.team_id, t.pool_label]));
    for (const m of bracket.matches.filter((mm) => mm.round_number === 1)) {
      if (m.team_a_id && m.team_b_id) {
        expect(byId.get(m.team_a_id)).not.toBe(byId.get(m.team_b_id));
      }
    }
  });
});

describe("splitCourts", () => {
  // Regression for the 2026-09-20 doubles: one pool -> court_count 1. The old
  // split gave the lone court to whichever bracket had more R1 games (silver's
  // 2 vs gold's 1), leaving gold with no court at all, and generateBracket's R1
  // interleave loop spun forever waiting for one.
  it("gives both brackets the single court when there is only one", () => {
    expect(splitCourts(1, 2, 4)).toEqual({ gold: [1], silver: [1] });
  });

  it("never hands a bracket that will be generated an empty court list", () => {
    // gold starts at 2: the modal disables Generate below two gold teams, and
    // generateBracket returns an empty bracket for fewer anyway.
    for (let total = 1; total <= 4; total++) {
      for (let gold = 2; gold <= 8; gold++) {
        for (let silver = 0; silver <= 8; silver++) {
          const label = `total=${total} gold=${gold} silver=${silver}`;
          const split = splitCourts(total, gold, silver);
          expect(split.gold.length, label).toBeGreaterThan(0);
          if (silver >= 2) expect(split.silver.length, label).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps the existing split when there are courts to go around", () => {
    expect(splitCourts(2, 2, 4)).toEqual({ gold: [1], silver: [2] });
    // 3 courts: the odd court goes to the bracket with more R1 games.
    expect(splitCourts(3, 8, 4)).toEqual({ gold: [1, 2], silver: [3] }); // gold 4 R1 games vs silver 2
    expect(splitCourts(3, 2, 8)).toEqual({ gold: [1], silver: [2, 3] }); // gold 1 vs silver 4
  });

  it("gives gold every court when silver has fewer than two teams", () => {
    expect(splitCourts(1, 6, 0)).toEqual({ gold: [1], silver: [] });
    expect(splitCourts(3, 6, 1)).toEqual({ gold: [1, 2, 3], silver: [] });
  });

  it("treats a missing or zero court count as one court, never none", () => {
    expect(splitCourts(0, 2, 4)).toEqual({ gold: [1], silver: [1] });
  });
});

describe("generateBracket – courts", () => {
  // Before the guard this call never returned: the R1 interleave loop waits on
  // an empty list of active courts. It must fail loudly, not hang.
  it("throws on an empty court list instead of looping forever", () => {
    expect(() => generateBracket([makeTeam(1), makeTeam(2)], "gold", 15, [])).toThrow(/court/i);
  });

  it("still returns an empty bracket for fewer than two teams, even with no courts", () => {
    expect(generateBracket([makeTeam(1)], "silver", 11, [])).toEqual({
      bracket_type: "silver", points_per_set: 11, slots: [], matches: [],
    });
  });

  it("orders a multi-round gold entirely before silver when they share one court", () => {
    // A 4-team gold has two rounds (two semis, then the final). Silver's R1 must
    // still come after gold's final, not just after gold's R1.
    const { gold, silver } = splitCourts(1, 4, 2);
    const g = generateBracket([1, 2, 3, 4].map((r) => makeTeam(r)), "gold", 15, gold);
    const s = generateBracket([makeTeam(5), makeTeam(6)], "silver", 11, silver, g.matches.length);
    expect(g.matches.length).toBe(3);
    expect(s.matches.length).toBe(1);

    const all = [...g.matches, ...s.matches];
    expect(all.every((m) => m.court_number === 1)).toBe(true);
    expect(all.map((m) => m.match_order)).toEqual(all.map((_, i) => i + 1));
    expect(Math.max(...g.matches.map((m) => m.match_order)))
      .toBeLessThan(Math.min(...s.matches.map((m) => m.match_order)));
  });
});
