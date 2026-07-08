import { describe, it, expect } from "vitest";
import { computePoolStandings } from "../standings";
import type { MatchFormat } from "../score-format";

const SINGLE: MatchFormat = { sets: 1, pointsPerSet: 15, pointsCap: 17 };
const DOUBLE: MatchFormat = { sets: 2, pointsPerSet: 15, pointsCap: 17 };

function team(id: string, opts: { seed?: number; withdrawn?: boolean } = {}) {
  return { team_id: id, team_name: id.toUpperCase(), seed_in_pool: opts.seed ?? 1, withdrawn: opts.withdrawn };
}
function match(id: string, a: string, b: string, sets: Array<[number, number]>) {
  return {
    id, team_a_id: a, team_b_id: b, status: "complete",
    sets: sets.map(([ta, tb]) => ({ team_a_score: ta, team_b_score: tb })),
  };
}

describe("computePoolStandings", () => {
  it("ranks by sets won (descending) — the official rule", () => {
    const teams = [team("a", { seed: 1 }), team("b", { seed: 2 }), team("c", { seed: 3 })];
    const matches = [
      match("m1", "a", "b", [[15, 5]]),
      match("m2", "a", "c", [[15, 5]]),
      match("m3", "b", "c", [[15, 5]]),
    ];
    const s = computePoolStandings(teams, matches, SINGLE);
    expect(s.map((t) => t.team_id)).toEqual(["a", "b", "c"]);
    expect(s[0].sets_won).toBe(2);
  });

  it("breaks an exact 2-team sets-won tie by head-to-head", () => {
    // Split sets (1-1) but A wins on cumulative points, so A holds the H2H.
    const teams = [team("a", { seed: 2 }), team("b", { seed: 1 })];
    const matches = [match("m1", "a", "b", [[15, 5], [13, 15]])];
    const s = computePoolStandings(teams, matches, DOUBLE);
    expect(s[0].sets_won).toBe(1);
    expect(s[1].sets_won).toBe(1);
    // H2H winner A ranks first despite B's lower seed.
    expect(s.map((t) => t.team_id)).toEqual(["a", "b"]);
  });

  it("falls back to point differential for a circular 3-way tie", () => {
    const teams = [team("a", { seed: 1 }), team("b", { seed: 2 }), team("c", { seed: 3 })];
    const matches = [
      match("m1", "a", "b", [[15, 0]]),  // A +15
      match("m2", "b", "c", [[15, 0]]),  // B +15
      match("m3", "c", "a", [[15, 13]]), // C +2, A -2
    ];
    const s = computePoolStandings(teams, matches, SINGLE);
    // Each won exactly 1 set -> circular -> H2H disabled (3-way) -> point diff.
    expect(s.map((t) => t.team_id)).toEqual(["a", "b", "c"]);
    expect(s[0].point_differential).toBe(13);
    expect(s[2].point_differential).toBe(-13);
  });

  it("sorts a withdrawn team last even with the best record", () => {
    const teams = [team("a", { seed: 2, withdrawn: true }), team("b", { seed: 1 })];
    const matches = [match("m1", "a", "b", [[15, 0]])]; // A 'won'
    const s = computePoolStandings(teams, matches, SINGLE);
    expect(s.map((t) => t.team_id)).toEqual(["b", "a"]);
    expect(s.find((t) => t.team_id === "a")!.sets_won).toBe(1); // record still computed
  });

  it("counts forfeit-style sets identically to played sets", () => {
    const teams = [team("a"), team("b")];
    const matches = [match("m1", "a", "b", [[15, 0], [15, 0]])];
    const s = computePoolStandings(teams, matches, DOUBLE);
    const a = s.find((t) => t.team_id === "a")!;
    expect(a.matches_won).toBe(1);
    expect(a.sets_won).toBe(2);
    expect(a.points_for).toBe(30);
  });

  it("preserves a real win over a team that later withdrew", () => {
    // B is withdrawn but still in the pool, so A's earlier win over B counts.
    const teams = [team("a", { seed: 1 }), team("b", { seed: 2, withdrawn: true })];
    const matches = [match("m1", "a", "b", [[15, 10]])];
    const s = computePoolStandings(teams, matches, SINGLE);
    const a = s.find((t) => t.team_id === "a")!;
    expect(a.matches_won).toBe(1);
    expect(a.sets_won).toBe(1);
    expect(s[0].team_id).toBe("a");
    expect(s[1].team_id).toBe("b");
  });
});
