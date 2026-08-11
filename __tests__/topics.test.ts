import { describe, it, expect } from "vitest";
import { validateTopic, buildTopicBetCounts, isTopicEditable, isTopicMine } from "../lib/topics";

// ─── validateTopic ────────────────────────────────────────────────────────────

describe("validateTopic — valid inputs", () => {
  it("returns null for a valid name", () => {
    expect(validateTopic({ name: "World Cup Final" })).toBeNull();
  });

  it("accepts a name with exactly 60 chars", () => {
    expect(validateTopic({ name: "a".repeat(60) })).toBeNull();
  });

  it("accepts an optional description field", () => {
    expect(validateTopic({ name: "Sports", description: "Soccer bets" })).toBeNull();
  });

  it("trims leading/trailing whitespace before checking length", () => {
    // 60 chars + 2 spaces on each side — still valid after trim
    expect(validateTopic({ name: "  " + "a".repeat(60) + "  " })).toBeNull();
  });
});

describe("validateTopic — name required", () => {
  it("rejects empty string", () => {
    expect(validateTopic({ name: "" })).toBe("name required");
  });

  it("rejects whitespace-only string", () => {
    expect(validateTopic({ name: "   " })).toBe("name required");
  });

  it("rejects null", () => {
    expect(validateTopic({ name: null })).toBe("name required");
  });

  it("rejects undefined", () => {
    expect(validateTopic({ name: undefined })).toBe("name required");
  });

  it("rejects number", () => {
    expect(validateTopic({ name: 42 })).toBe("name required");
  });

  it("rejects array", () => {
    expect(validateTopic({ name: ["Sports"] })).toBe("name required");
  });
});

describe("validateTopic — name too long", () => {
  it("rejects a name with 61 chars", () => {
    expect(validateTopic({ name: "a".repeat(61) })).toBe("name max 60 chars");
  });

  it("rejects a very long name", () => {
    expect(validateTopic({ name: "x".repeat(200) })).toBe("name max 60 chars");
  });

  it("measures trimmed length — trailing spaces do not pad a short name over 60", () => {
    const trimmed60 = "a".repeat(60);
    expect(validateTopic({ name: trimmed60 + "   " })).toBeNull();
  });

  it("measures trimmed length — interior content over 60 still fails", () => {
    expect(validateTopic({ name: "  " + "a".repeat(61) + "  " })).toBe("name max 60 chars");
  });
});

// ─── buildTopicBetCounts ──────────────────────────────────────────────────────

describe("buildTopicBetCounts — basic counting", () => {
  it("returns empty object for empty input", () => {
    expect(buildTopicBetCounts([])).toEqual({});
  });

  it("counts a single bet for a topic", () => {
    expect(buildTopicBetCounts([{ topic_id: "topic-1" }])).toEqual({ "topic-1": 1 });
  });

  it("counts multiple bets for the same topic", () => {
    const rows = [
      { topic_id: "topic-1" },
      { topic_id: "topic-1" },
      { topic_id: "topic-1" },
    ];
    expect(buildTopicBetCounts(rows)).toEqual({ "topic-1": 3 });
  });

  it("counts bets across multiple topics independently", () => {
    const rows = [
      { topic_id: "topic-1" },
      { topic_id: "topic-2" },
      { topic_id: "topic-1" },
    ];
    expect(buildTopicBetCounts(rows)).toEqual({ "topic-1": 2, "topic-2": 1 });
  });
});

describe("buildTopicBetCounts — null handling", () => {
  it("skips rows with null topic_id", () => {
    const rows = [{ topic_id: null }, { topic_id: null }];
    expect(buildTopicBetCounts(rows)).toEqual({});
  });

  it("skips null rows but counts non-null ones", () => {
    const rows = [
      { topic_id: null },
      { topic_id: "topic-1" },
      { topic_id: null },
      { topic_id: "topic-1" },
    ];
    expect(buildTopicBetCounts(rows)).toEqual({ "topic-1": 2 });
  });

  it("total across all topics equals number of non-null rows", () => {
    const rows = [
      { topic_id: "a" },
      { topic_id: "b" },
      { topic_id: null },
      { topic_id: "a" },
    ];
    const counts = buildTopicBetCounts(rows);
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    expect(total).toBe(3);
  });
});

// ─── isTopicEditable ──────────────────────────────────────────────────────────

describe("isTopicEditable — claimed topics", () => {
  it("returns true when the user is the creator", () => {
    expect(isTopicEditable("user-1", "user-1")).toBe(true);
  });

  it("returns false when the user is not the creator", () => {
    expect(isTopicEditable("user-1", "user-2")).toBe(false);
  });

  it("returns false for a different user even when IDs are similar", () => {
    expect(isTopicEditable("user-1", "user-10")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isTopicEditable("User-1", "user-1")).toBe(false);
  });
});

describe("isTopicEditable — unclaimed topics (creator_id null)", () => {
  it("returns true for any user when creator_id is null", () => {
    expect(isTopicEditable(null, "any-user")).toBe(true);
  });

  it("returns true for a second user when creator_id is null", () => {
    expect(isTopicEditable(null, "user-abc")).toBe(true);
  });

  it("returns true even with an empty string userId when creator_id is null", () => {
    expect(isTopicEditable(null, "")).toBe(true);
  });
});

// ─── isTopicMine ─────────────────────────────────────────────────────────────

describe("isTopicMine — claimed topics", () => {
  it("returns true for the owning user", () => {
    expect(isTopicMine("alice", "alice")).toBe(true);
  });

  it("returns false for a different user", () => {
    expect(isTopicMine("alice", "bob")).toBe(false);
  });
});

describe("isTopicMine — legacy unclaimed topics (creator_id null)", () => {
  it("returns true for any user so they can see the delete button", () => {
    expect(isTopicMine(null, "alice")).toBe(true);
    expect(isTopicMine(null, "bob")).toBe(true);
  });

  it("is consistent with isTopicEditable for the null case", () => {
    expect(isTopicMine(null, "anyone")).toBe(isTopicEditable(null, "anyone"));
  });
});
