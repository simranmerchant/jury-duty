import { describe, it, expect } from "vitest";
import { computeOutcome } from "../lib/outcome";

describe("computeOutcome", () => {
  it("returns pending when bet is not resolved", () => {
    expect(computeOutcome("open", "opt-1", "opt-1")).toBe("pending");
    expect(computeOutcome("open", null, "opt-1")).toBe("pending");
    expect(computeOutcome("closed", "opt-1", "opt-1")).toBe("pending");
  });

  it("returns refunded when bet resolved with no winner", () => {
    expect(computeOutcome("resolved", null, "opt-1")).toBe("refunded");
    expect(computeOutcome("resolved", null, "opt-2")).toBe("refunded");
  });

  it("returns won when entry option matches winning option", () => {
    expect(computeOutcome("resolved", "opt-1", "opt-1")).toBe("won");
  });

  it("returns lost when entry option does not match winning option", () => {
    expect(computeOutcome("resolved", "opt-1", "opt-2")).toBe("lost");
    expect(computeOutcome("resolved", "opt-2", "opt-1")).toBe("lost");
  });

  it("is case-sensitive for option IDs", () => {
    expect(computeOutcome("resolved", "OPT-1", "opt-1")).toBe("lost");
  });
});
