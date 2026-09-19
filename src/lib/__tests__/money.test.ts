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

  it("shows both decimal places when an amount has cents", () => {
    expect(formatCents(2550)).toBe("$25.50");
    expect(formatCents(2505)).toBe("$25.05");
    expect(formatCents(349)).toBe("$3.49");
  });

  // Unlike formatPriceUSD in ../format, which rounds to whole dollars.
  it("never rounds cents away", () => {
    expect(formatCents(2599)).toBe("$25.99");
    expect(formatCents(2501)).toBe("$25.01");
  });

  it("groups thousands", () => {
    expect(formatCents(100000)).toBe("$1,000");
  });
});
