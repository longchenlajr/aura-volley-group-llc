import { describe, it, expect } from "vitest";
import { computeOverallStandings } from "../tournament-standings";
import type { PoolStandings } from "../standings";

function makePool(
  id: string,
  label: string,
  teams: Array<{
    id: string;
    matches_won: number;
    matches_lost: number;
    sets_won: number;
    sets_lost: number;
    points_for: number;
    points_against: number;
  }>,
): PoolStandings {
  return {
    pool_id: id,
    pool_label: label,
    court_number: 1,
    standings: teams.map((t, i) => ({
      team_id: t.id,
      team_name: t.id,
      seed_in_pool: i + 1,
      overall_seed: null,
      withdrawn: false,
      matches_played: t.matches_won + t.matches_lost,
      matches_won: t.matches_won,
      matches_lost: t.matches_lost,
      sets_won: t.sets_won,
      sets_lost: t.sets_lost,
      points_for: t.points_for,
      points_against: t.points_against,
      point_differential: t.points_for - t.points_against,
    })),
  };
}

describe("computeOverallStandings", () => {
  it("ranks 1st-place pool finishers above 2nd-place finishers across pools", () => {
    const pool1 = makePool("p1", "A", [
      { id: "a1", matches_won: 2, matches_lost: 0, sets_won: 4, sets_lost: 0, points_for: 60, points_against: 20 },
      { id: "a2", matches_won: 1, matches_lost: 1, sets_won: 2, sets_lost: 2, points_for: 40, points_against: 40 },
      { id: "a3", matches_won: 0, matches_lost: 2, sets_won: 0, sets_lost: 4, points_for: 20, points_against: 60 },
    ]);
    const pool2 = makePool("p2", "B", [
      { id: "b1", matches_won: 2, matches_lost: 0, sets_won: 4, sets_lost: 0, points_for: 60, points_against: 20 },
      { id: "b2", matches_won: 1, matches_lost: 1, sets_won: 2, sets_lost: 2, points_for: 40, points_against: 40 },
      { id: "b3", matches_won: 0, matches_lost: 2, sets_won: 0, sets_lost: 4, points_for: 20, points_against: 60 },
    ]);

    const standings = computeOverallStandings([pool1, pool2]);
    const rank = (id: string) => standings.find((t) => t.team_id === id)!.overall_rank;

    expect(rank("a1")).toBeLessThan(rank("a2"));
    expect(rank("b1")).toBeLessThan(rank("b2"));
    expect(rank("a2")).toBeLessThan(rank("a3"));
  });

  it("assigns sequential overall_rank starting at 1", () => {
    const pool = makePool("p1", "A", [
      { id: "x1", matches_won: 2, matches_lost: 0, sets_won: 4, sets_lost: 0, points_for: 60, points_against: 20 },
      { id: "x2", matches_won: 1, matches_lost: 1, sets_won: 2, sets_lost: 2, points_for: 40, points_against: 40 },
      { id: "x3", matches_won: 0, matches_lost: 2, sets_won: 0, sets_lost: 4, points_for: 20, points_against: 60 },
    ]);
    const standings = computeOverallStandings([pool]);
    expect(standings.map((t) => t.overall_rank).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("uses set win % as tiebreaker within same pool-rank tier", () => {
    // Both are pool rank 1; a1 has perfect set win%, b1 does not
    const pool1 = makePool("p1", "A", [
      { id: "a1", matches_won: 1, matches_lost: 0, sets_won: 2, sets_lost: 0, points_for: 30, points_against: 10 },
    ]);
    const pool2 = makePool("p2", "B", [
      { id: "b1", matches_won: 1, matches_lost: 0, sets_won: 2, sets_lost: 1, points_for: 30, points_against: 10 },
    ]);
    const standings = computeOverallStandings([pool1, pool2]);
    const rank = (id: string) => standings.find((t) => t.team_id === id)!.overall_rank;

    // a1: set_win_pct = 2/2 = 1.0 > b1: set_win_pct = 2/3 ≈ 0.67
    expect(rank("a1")).toBeLessThan(rank("b1"));
  });

  it("uses point % as secondary tiebreaker when set win % is equal", () => {
    const pool1 = makePool("p1", "A", [
      { id: "a1", matches_won: 1, matches_lost: 0, sets_won: 2, sets_lost: 0, points_for: 40, points_against: 10 },
    ]);
    const pool2 = makePool("p2", "B", [
      { id: "b1", matches_won: 1, matches_lost: 0, sets_won: 2, sets_lost: 0, points_for: 30, points_against: 20 },
    ]);
    const standings = computeOverallStandings([pool1, pool2]);
    const rank = (id: string) => standings.find((t) => t.team_id === id)!.overall_rank;

    // Both 2/2 set win%; a1 point_pct = 40/50 = 0.8 > b1 point_pct = 30/50 = 0.6
    expect(rank("a1")).toBeLessThan(rank("b1"));
  });

  it("overall_rank on each standing object matches its position in the returned array", () => {
    const pool = makePool("p1", "A", [
      { id: "x1", matches_won: 2, matches_lost: 0, sets_won: 4, sets_lost: 0, points_for: 60, points_against: 20 },
      { id: "x2", matches_won: 0, matches_lost: 2, sets_won: 0, sets_lost: 4, points_for: 20, points_against: 60 },
    ]);
    const standings = computeOverallStandings([pool]);
    standings.forEach((t, i) => {
      expect(t.overall_rank).toBe(i + 1);
    });
  });
});
