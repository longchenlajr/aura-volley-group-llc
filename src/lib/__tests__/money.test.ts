import { describe, it, expect } from "vitest";
import { formatCents } from "../money";

describe("formatCents", () => {
  it("formats whole-dollar cent amounts", () => {
    expect(formatCents(2500)).toBe("$25");
    expect(formatCents(5000)).toBe("$50");
    expect(formatCents(7500)).toBe("$75");
    expect(formatCents(15000)).toBe("$150");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });
});
