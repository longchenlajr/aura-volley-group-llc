import { describe, it, expect } from "vitest";
import { getTournaments, getStandardEntryFeeCents } from "../tournaments";

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
    }
  });
});
