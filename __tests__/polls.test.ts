import { describe, it, expect } from "vitest";
import { validatePoll, aggregatePollVotes, aggregatePollReactions } from "../lib/polls";

const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();
const NOW_MS = Date.now();

// ─── validatePoll — question ───────────────────────────────────────────────────

describe("validatePoll — question", () => {
  it("returns null for a valid poll", () => {
    expect(validatePoll({ question: "Will it rain?", option_a: "Yes", option_b: "No" }, NOW_MS)).toBeNull();
  });

  it("rejects missing question", () => {
    expect(validatePoll({ question: "", option_a: "Yes", option_b: "No" }, NOW_MS)).toBe("question required");
  });

  it("rejects whitespace-only question", () => {
    expect(validatePoll({ question: "   ", option_a: "Yes", option_b: "No" }, NOW_MS)).toBe("question required");
  });

  it("rejects null question", () => {
    expect(validatePoll({ question: null, option_a: "Yes", option_b: "No" }, NOW_MS)).toBe("question required");
  });

  it("rejects question over 200 chars", () => {
    const long = "a".repeat(201);
    expect(validatePoll({ question: long, option_a: "Yes", option_b: "No" }, NOW_MS)).toBe("question too long");
  });

  it("accepts a question exactly 200 chars", () => {
    const max = "a".repeat(200);
    expect(validatePoll({ question: max, option_a: "Yes", option_b: "No" }, NOW_MS)).toBeNull();
  });
});

// ─── validatePoll — option_a ──────────────────────────────────────────────────

describe("validatePoll — option_a", () => {
  it("rejects missing option_a", () => {
    expect(validatePoll({ question: "q?", option_a: "", option_b: "No" }, NOW_MS)).toBe("option_a required");
  });

  it("rejects null option_a", () => {
    expect(validatePoll({ question: "q?", option_a: null, option_b: "No" }, NOW_MS)).toBe("option_a required");
  });

  it("rejects option_a over 80 chars", () => {
    const long = "a".repeat(81);
    expect(validatePoll({ question: "q?", option_a: long, option_b: "No" }, NOW_MS)).toBe("option_a too long");
  });

  it("accepts option_a exactly 80 chars", () => {
    const max = "a".repeat(80);
    expect(validatePoll({ question: "q?", option_a: max, option_b: "No" }, NOW_MS)).toBeNull();
  });
});

// ─── validatePoll — option_b ──────────────────────────────────────────────────

describe("validatePoll — option_b", () => {
  it("rejects missing option_b", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: "" }, NOW_MS)).toBe("option_b required");
  });

  it("rejects null option_b", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: null }, NOW_MS)).toBe("option_b required");
  });

  it("rejects option_b over 80 chars", () => {
    const long = "b".repeat(81);
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: long }, NOW_MS)).toBe("option_b too long");
  });

  it("accepts option_b exactly 80 chars", () => {
    const max = "b".repeat(80);
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: max }, NOW_MS)).toBeNull();
  });
});

// ─── validatePoll — closes_at ─────────────────────────────────────────────────

describe("validatePoll — closes_at", () => {
  it("accepts a valid future closes_at", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: "No", closes_at: FUTURE }, NOW_MS)).toBeNull();
  });

  it("accepts undefined closes_at (optional)", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: "No" }, NOW_MS)).toBeNull();
  });

  it("accepts null closes_at (optional)", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: "No", closes_at: null }, NOW_MS)).toBeNull();
  });

  it("rejects closes_at in the past", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: "No", closes_at: PAST }, NOW_MS))
      .toBe("closes_at must be in the future");
  });

  it("rejects a non-date closes_at string", () => {
    expect(validatePoll({ question: "q?", option_a: "Yes", option_b: "No", closes_at: "not-a-date" }, NOW_MS))
      .toBe("closes_at must be in the future");
  });
});

// ─── aggregatePollVotes ────────────────────────────────────────────────────────

describe("aggregatePollVotes", () => {
  it("returns zeros for empty votes", () => {
    expect(aggregatePollVotes([])).toEqual({ votes_a: 0, votes_b: 0, total_votes: 0 });
  });

  it("counts a-side votes correctly", () => {
    const result = aggregatePollVotes([{ side: "a" }, { side: "a" }, { side: "b" }]);
    expect(result).toEqual({ votes_a: 2, votes_b: 1, total_votes: 3 });
  });

  it("counts b-side votes correctly", () => {
    const result = aggregatePollVotes([{ side: "b" }, { side: "b" }]);
    expect(result).toEqual({ votes_a: 0, votes_b: 2, total_votes: 2 });
  });

  it("total_votes equals votes_a + votes_b", () => {
    const votes = [{ side: "a" }, { side: "b" }, { side: "a" }, { side: "b" }, { side: "b" }];
    const result = aggregatePollVotes(votes);
    expect(result.total_votes).toBe(result.votes_a + result.votes_b);
  });
});

// ─── aggregatePollReactions ────────────────────────────────────────────────────

describe("aggregatePollReactions", () => {
  it("returns empty array for no reactions", () => {
    expect(aggregatePollReactions([])).toEqual([]);
  });

  it("groups reactions by emoji", () => {
    const reactions = [{ emoji: "🔥" }, { emoji: "🔥" }, { emoji: "👀" }];
    const result = aggregatePollReactions(reactions);
    const fire = result.find((r) => r.emoji === "🔥");
    const eyes = result.find((r) => r.emoji === "👀");
    expect(fire?.count).toBe(2);
    expect(eyes?.count).toBe(1);
  });

  it("returns one entry per unique emoji", () => {
    const reactions = [{ emoji: "🔥" }, { emoji: "🔥" }, { emoji: "🎯" }];
    expect(aggregatePollReactions(reactions)).toHaveLength(2);
  });

  it("handles single reaction", () => {
    const result = aggregatePollReactions([{ emoji: "😂" }]);
    expect(result).toEqual([{ emoji: "😂", count: 1 }]);
  });
});
