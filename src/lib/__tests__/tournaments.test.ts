import { describe, it, expect } from "vitest";
import { getTournaments, getStandardEntryFeeCents } from "../tournaments";
import { formatCents } from "../money";

describe("getStandardEntryFeeCents", () => {
  it("returns the priceCents of a doubles-format tournament from config", () => {
    const doublesTournament = getTournaments().find((t) => t.format === "doubles");
    expect(doublesTournament).toBeDefined();
    expect(getStandardEntryFeeCents()).toBe(doublesTournament!.priceCents);
  });
});

describe("tournaments config", () => {
  it("every configured tournament has a priceCents", () => {
    for (const t of getTournaments()) {
      expect(typeof t.priceCents).toBe("number");
      expect(t.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(t.priceCents)).toBe(true);
    }
  });

  // Issue #22: "Amounts render identically to today for every existing
  // tournament." Today every tournament is $25/player, so the team total is
  // teamSize * $25 — $50 doubles through $150 sixes. This pins that migration;
  // it is expected to be updated the first time a price legitimately changes.
  it("renders the same amounts the hardcoded $25 literal produced", () => {
    for (const t of getTournaments()) {
      expect(formatCents(t.priceCents)).toBe("$25");
      expect(formatCents(t.priceCents * t.teamSize)).toBe(`$${t.teamSize * 25}`);
    }
  });
});
