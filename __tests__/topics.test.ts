import { describe, it, expect } from "vitest";
import { validateTopic, buildTopicBetCounts } from "../lib/topics";

// ─── validateTopic ────────────────────────────────────────────────────────────

describe("validateTopic — valid inputs", () => {
  it("returns null for a valid name", () => {
    expect(validateTopic({ name: "World Cup Final" })).toBeNull();
  });

  it("accepts a name with exactly 60 chars", () => {
    expect(validateTopic({ name: "a".repeat(60) })).toBeNull();
  });

  it("ignores optional emoji and description", () => {
    expect(validateTopic({ name: "Sports", emoji: "⚽", description: "Soccer bets" })).toBeNull();
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
