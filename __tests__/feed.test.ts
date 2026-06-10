import { describe, it, expect } from "vitest";
import { validateFeedBet, buildFeedBetNotification } from "../lib/feed";

const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();
const NOW_MS = Date.now();

// ─── validateFeedBet ───────────────────────────────────────────────────────────

describe("validateFeedBet — question", () => {
  it("returns null for a valid request", () => {
    expect(validateFeedBet({ question: "will it rain?", options: ["yes", "no"], deadline: FUTURE }, NOW_MS)).toBeNull();
  });

  it("rejects missing question", () => {
    expect(validateFeedBet({ question: "", options: ["yes", "no"], deadline: FUTURE }, NOW_MS))
      .toBe("question required (max 200 chars)");
  });

  it("rejects whitespace-only question", () => {
    expect(validateFeedBet({ question: "   ", options: ["yes", "no"], deadline: FUTURE }, NOW_MS))
      .toBe("question required (max 200 chars)");
  });

  it("rejects null question", () => {
    expect(validateFeedBet({ question: null, options: ["yes", "no"], deadline: FUTURE }, NOW_MS))
      .toBe("question required (max 200 chars)");
  });

  it("rejects question over 200 chars", () => {
    const long = "a".repeat(201);
    expect(validateFeedBet({ question: long, options: ["yes", "no"], deadline: FUTURE }, NOW_MS))
      .toBe("question required (max 200 chars)");
  });

  it("accepts a question exactly 200 chars", () => {
    const max = "a".repeat(200);
    expect(validateFeedBet({ question: max, options: ["yes", "no"], deadline: FUTURE }, NOW_MS)).toBeNull();
  });
});

describe("validateFeedBet — options", () => {
  it("rejects non-array options", () => {
    expect(validateFeedBet({ question: "q?", options: "yes", deadline: FUTURE }, NOW_MS))
      .toBe("at least 2 options required");
  });

  it("rejects fewer than 2 options", () => {
    expect(validateFeedBet({ question: "q?", options: ["only one"], deadline: FUTURE }, NOW_MS))
      .toBe("at least 2 options required");
  });

  it("rejects empty array", () => {
    expect(validateFeedBet({ question: "q?", options: [], deadline: FUTURE }, NOW_MS))
      .toBe("at least 2 options required");
  });

  it("accepts exactly 2 options", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: FUTURE }, NOW_MS)).toBeNull();
  });

  it("accepts up to 5 options", () => {
    const opts = ["a", "b", "c", "d", "e"];
    expect(validateFeedBet({ question: "q?", options: opts, deadline: FUTURE }, NOW_MS)).toBeNull();
  });

  it("rejects an option that is empty string", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", ""], deadline: FUTURE }, NOW_MS))
      .toBe("each option must be 1-100 chars");
  });

  it("rejects an option over 100 chars", () => {
    const long = "x".repeat(101);
    expect(validateFeedBet({ question: "q?", options: ["yes", long], deadline: FUTURE }, NOW_MS))
      .toBe("each option must be 1-100 chars");
  });

  it("accepts object-shaped options with label field", () => {
    const opts = [{ label: "yes" }, { label: "no" }];
    expect(validateFeedBet({ question: "q?", options: opts, deadline: FUTURE }, NOW_MS)).toBeNull();
  });

  it("rejects object options with empty label", () => {
    const opts = [{ label: "yes" }, { label: "" }];
    expect(validateFeedBet({ question: "q?", options: opts, deadline: FUTURE }, NOW_MS))
      .toBe("each option must be 1-100 chars");
  });
});

describe("validateFeedBet — deadline", () => {
  it("rejects missing deadline", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: null }, NOW_MS))
      .toBe("deadline required");
  });

  it("rejects undefined deadline", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: undefined }, NOW_MS))
      .toBe("deadline required");
  });

  it("rejects a deadline in the past", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: PAST }, NOW_MS))
      .toBe("deadline must be in the future");
  });

  it("rejects a deadline equal to now", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: new Date(NOW_MS).toISOString() }, NOW_MS))
      .toBe("deadline must be in the future");
  });

  it("accepts a deadline 1ms in the future", () => {
    const justFuture = new Date(NOW_MS + 1).toISOString();
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: justFuture }, NOW_MS)).toBeNull();
  });

  it("rejects a non-date string", () => {
    expect(validateFeedBet({ question: "q?", options: ["yes", "no"], deadline: "not-a-date" }, NOW_MS))
      .toBe("deadline must be in the future");
  });
});

// ─── buildFeedBetNotification ──────────────────────────────────────────────────

describe("buildFeedBetNotification", () => {
  it("returns new_feed_bet type", () => {
    const n = buildFeedBetNotification("Alice", "will it rain?");
    expect(n.type).toBe("new_feed_bet");
  });

  it("includes creator name in title", () => {
    const n = buildFeedBetNotification("Alice", "will it rain?");
    expect(n.title).toContain("Alice");
  });

  it("uses the question as the body", () => {
    const n = buildFeedBetNotification("Bob", "  will it snow?  ");
    expect(n.body).toBe("will it snow?");
  });

  it("trims whitespace from the question in body", () => {
    const n = buildFeedBetNotification("Bob", "  spaced  ");
    expect(n.body).toBe("spaced");
  });

  it("works with anonymous creator name 'someone'", () => {
    const n = buildFeedBetNotification("someone", "q?");
    expect(n.title).toContain("someone");
    expect(n.type).toBe("new_feed_bet");
  });
});
