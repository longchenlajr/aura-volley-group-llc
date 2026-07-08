import { describe, it, expect } from "vitest";
import { isSetComplete, isMatchComplete, matchWinner, type MatchFormat } from "../score-format";

const DOUBLE: MatchFormat = { sets: 2, pointsPerSet: 15, pointsCap: 17 };

describe("isSetComplete", () => {
  it("is not complete below the points target", () => {
    expect(isSetComplete(10, 8, 15, 17)).toBe(false);
  });
  it("requires win-by-2 below the cap", () => {
    expect(isSetComplete(15, 14, 15, 17)).toBe(false);
    expect(isSetComplete(15, 13, 15, 17)).toBe(true);
  });
  it("allows win-by-1 at the cap", () => {
    expect(isSetComplete(17, 16, 15, 17)).toBe(true);
  });
  it("with no cap (playoffs) requires pure win-by-2", () => {
    expect(isSetComplete(15, 14, 15, undefined)).toBe(false);
    expect(isSetComplete(16, 14, 15, undefined)).toBe(true);
  });
});

describe("isMatchComplete", () => {
  it("needs every scheduled set complete", () => {
    expect(isMatchComplete([{ set_number: 1, team_a_score: 15, team_b_score: 5 }], DOUBLE)).toBe(false);
    expect(isMatchComplete([
      { set_number: 1, team_a_score: 15, team_b_score: 5 },
      { set_number: 2, team_a_score: 15, team_b_score: 9 },
    ], DOUBLE)).toBe(true);
  });
});

describe("matchWinner", () => {
  it("single set: higher score wins", () => {
    const fmt: MatchFormat = { sets: 1, pointsPerSet: 15, pointsCap: 17 };
    expect(matchWinner([{ set_number: 1, team_a_score: 15, team_b_score: 11 }], fmt)).toBe("team_a");
  });
  it("two sets won by one team", () => {
    expect(matchWinner([
      { set_number: 1, team_a_score: 15, team_b_score: 5 },
      { set_number: 2, team_a_score: 15, team_b_score: 9 },
    ], DOUBLE)).toBe("team_a");
  });
  it("returns null on a split with equal cumulative points", () => {
    expect(matchWinner([
      { set_number: 1, team_a_score: 15, team_b_score: 10 },
      { set_number: 2, team_a_score: 10, team_b_score: 15 },
    ], DOUBLE)).toBeNull();
  });
});
