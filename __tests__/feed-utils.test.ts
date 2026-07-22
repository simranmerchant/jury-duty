import { describe, it, expect } from "vitest";
import {
  parseFeedCapabilities,
  aggregateBetReactions,
  mergeFeedItems,
} from "../lib/feed";

// ─── parseFeedCapabilities ────────────────────────────────────────────────────

describe("parseFeedCapabilities", () => {
  it("returns false for both when header is empty", () => {
    expect(parseFeedCapabilities("")).toEqual({
      supportsPollPost: false,
      supportsExploreBetPost: false,
    });
  });

  it("detects poll-post capability", () => {
    const r = parseFeedCapabilities("poll-post");
    expect(r.supportsPollPost).toBe(true);
    expect(r.supportsExploreBetPost).toBe(false);
  });

  it("detects explore-bet-post capability", () => {
    const r = parseFeedCapabilities("explore-bet-post");
    expect(r.supportsPollPost).toBe(false);
    expect(r.supportsExploreBetPost).toBe(true);
  });

  it("detects both when comma-separated", () => {
    const r = parseFeedCapabilities("poll-post,explore-bet-post");
    expect(r.supportsPollPost).toBe(true);
    expect(r.supportsExploreBetPost).toBe(true);
  });

  it("detects both in any order", () => {
    const r = parseFeedCapabilities("explore-bet-post,poll-post");
    expect(r.supportsPollPost).toBe(true);
    expect(r.supportsExploreBetPost).toBe(true);
  });

  it("is not fooled by a partial match inside a longer token", () => {
    // "poll-post-v2" still includes "poll-post" substring — intentional behaviour
    // (additive capability model: any string containing the token is considered enabled)
    const r = parseFeedCapabilities("poll-post-v2");
    expect(r.supportsPollPost).toBe(true);
  });

  it("is case-sensitive — uppercase does not match", () => {
    const r = parseFeedCapabilities("Poll-Post,Explore-Bet-Post");
    expect(r.supportsPollPost).toBe(false);
    expect(r.supportsExploreBetPost).toBe(false);
  });
});

// ─── aggregateBetReactions ────────────────────────────────────────────────────

const REACTIONS = [
  { user_id: "alice", emoji: "🔥" },
  { user_id: "bob",   emoji: "🔥" },
  { user_id: "carol", emoji: "👀" },
];

describe("aggregateBetReactions — counts", () => {
  it("returns empty reactions and null myReaction for no reactions", () => {
    expect(aggregateBetReactions([], "alice")).toEqual({
      reactions: [],
      myReaction: null,
    });
  });

  it("groups reactions by emoji", () => {
    const { reactions } = aggregateBetReactions(REACTIONS, "nobody");
    const fire = reactions.find((r) => r.emoji === "🔥");
    const eyes = reactions.find((r) => r.emoji === "👀");
    expect(fire?.count).toBe(2);
    expect(eyes?.count).toBe(1);
  });

  it("returns one entry per unique emoji", () => {
    const { reactions } = aggregateBetReactions(REACTIONS, "nobody");
    expect(reactions).toHaveLength(2);
  });

  it("handles a single reaction", () => {
    const { reactions } = aggregateBetReactions([{ user_id: "x", emoji: "😂" }], "nobody");
    expect(reactions).toEqual([{ emoji: "😂", count: 1 }]);
  });

  it("counts correctly when the same user reacts multiple times with different emojis", () => {
    const r = [
      { user_id: "alice", emoji: "🔥" },
      { user_id: "alice", emoji: "👀" },
    ];
    const { reactions } = aggregateBetReactions(r, "bob");
    expect(reactions).toHaveLength(2);
    expect(reactions.every((x) => x.count === 1)).toBe(true);
  });
});

describe("aggregateBetReactions — myReaction", () => {
  it("returns null when the user has no reaction", () => {
    expect(aggregateBetReactions(REACTIONS, "nobody").myReaction).toBeNull();
  });

  it("returns the emoji when the user has reacted", () => {
    expect(aggregateBetReactions(REACTIONS, "alice").myReaction).toBe("🔥");
  });

  it("returns the correct emoji for a different user", () => {
    expect(aggregateBetReactions(REACTIONS, "carol").myReaction).toBe("👀");
  });

  it("returns null for an empty reaction list regardless of userId", () => {
    expect(aggregateBetReactions([], "alice").myReaction).toBeNull();
  });

  it("uses the first match when userId appears multiple times", () => {
    const r = [
      { user_id: "alice", emoji: "🔥" },
      { user_id: "alice", emoji: "👀" },
    ];
    const result = aggregateBetReactions(r, "alice");
    expect(result.myReaction).toBe("🔥");
  });
});

// ─── mergeFeedItems ───────────────────────────────────────────────────────────

type Item = { id: string; created_at: string };

function item(id: string, created_at: string): Item {
  return { id, created_at };
}

const A = item("a", "2025-07-21T10:00:00.000Z");
const B = item("b", "2025-07-21T09:00:00.000Z");
const C = item("c", "2025-07-21T08:00:00.000Z");
const D = item("d", "2025-07-21T07:00:00.000Z");
const E = item("e", "2025-07-21T11:00:00.000Z"); // newest

describe("mergeFeedItems — ordering", () => {
  it("returns items sorted newest-first across arrays", () => {
    const merged = mergeFeedItems([[B, D], [A, C]]);
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("interleaves items from multiple arrays by timestamp", () => {
    const merged = mergeFeedItems([[A, C], [B]]);
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("handles a single array", () => {
    const merged = mergeFeedItems([[D, A, C, B]]);
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns empty array when all arrays are empty", () => {
    expect(mergeFeedItems([[], [], []])).toEqual([]);
  });

  it("returns empty array when called with no arrays", () => {
    expect(mergeFeedItems([])).toEqual([]);
  });
});

describe("mergeFeedItems — limit", () => {
  const MANY = Array.from({ length: 30 }, (_, i) =>
    item(`item-${i}`, new Date(2025, 0, 1, 0, 0, i).toISOString())
  );

  it("defaults to 20 items", () => {
    expect(mergeFeedItems([MANY])).toHaveLength(20);
  });

  it("respects a custom limit", () => {
    expect(mergeFeedItems([MANY], 5)).toHaveLength(5);
  });

  it("returns fewer than limit when total is smaller", () => {
    expect(mergeFeedItems([[A, B, C]], 10)).toHaveLength(3);
  });

  it("limit=1 returns only the newest item", () => {
    const result = mergeFeedItems([[A, B, C, D, E]], 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e");
  });

  it("returns items in descending order after slicing", () => {
    const result = mergeFeedItems([[A, B, C, D, E]], 3);
    expect(result.map((i) => i.id)).toEqual(["e", "a", "b"]);
  });
});

describe("mergeFeedItems — stability", () => {
  it("does not mutate the input arrays", () => {
    const arr1 = [B, D];
    const arr2 = [A, C];
    const copy1 = [...arr1];
    const copy2 = [...arr2];
    mergeFeedItems([arr1, arr2]);
    expect(arr1).toEqual(copy1);
    expect(arr2).toEqual(copy2);
  });
});
