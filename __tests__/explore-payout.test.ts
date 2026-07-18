import { describe, it, expect } from "vitest";
import { computeExplorePayout, type ExploreEntry } from "../lib/explore-payout";

function entry(user_id: string, side: "a" | "b", points_wagered: number): ExploreEntry {
  return { user_id, side, points_wagered };
}

describe("computeExplorePayout — void (winning_side=null)", () => {
  it("refunds every entrant their exact stake", () => {
    const entries = [entry("alice", "a", 100), entry("bob", "b", 200)];
    expect(computeExplorePayout(entries, null)).toEqual({ alice: 100, bob: 200 });
  });

  it("returns empty map when there are no entries", () => {
    expect(computeExplorePayout([], null)).toEqual({});
  });

  it("sums refunds when the same user bet multiple times", () => {
    const entries = [entry("alice", "a", 50), entry("alice", "b", 75)];
    expect(computeExplorePayout(entries, null)).toEqual({ alice: 125 });
  });
});

describe("computeExplorePayout — no entries on winning side", () => {
  it("refunds everyone when nobody picked the winner", () => {
    const entries = [entry("alice", "a", 100), entry("bob", "a", 200)];
    expect(computeExplorePayout(entries, "b")).toEqual({ alice: 100, bob: 200 });
  });

  it("refunds everyone when the winning side has zero total stakes", () => {
    const entries = [entry("carol", "b", 150)];
    expect(computeExplorePayout(entries, "a")).toEqual({ carol: 150 });
  });
});

describe("computeExplorePayout — single winner takes full pot", () => {
  it("winner receives entire pot", () => {
    const entries = [entry("alice", "a", 100), entry("bob", "b", 200)];
    expect(computeExplorePayout(entries, "a")).toEqual({ alice: 300 });
  });

  it("winner with no opposition receives own stake", () => {
    const entries = [entry("alice", "a", 100)];
    expect(computeExplorePayout(entries, "a")).toEqual({ alice: 100 });
  });

  it("losers receive nothing", () => {
    const entries = [entry("alice", "a", 50), entry("bob", "b", 150)];
    const result = computeExplorePayout(entries, "a");
    expect(result.bob).toBeUndefined();
  });
});

describe("computeExplorePayout — multiple winners split proportionally", () => {
  it("splits pot proportional to stake", () => {
    // alice=100 on A, bob=200 on A, carol=150 on B → total=450, winner_total=300
    // alice: floor(100/300 * 450) = floor(150) = 150
    // bob (last): 450 - 150 = 300
    const entries = [entry("alice", "a", 100), entry("bob", "a", 200), entry("carol", "b", 150)];
    const result = computeExplorePayout(entries, "a");
    expect(result.alice).toBe(150);
    expect(result.bob).toBe(300);
    expect(result.carol).toBeUndefined();
  });

  it("total payout always equals total pot", () => {
    const entries = [
      entry("alice", "a", 250),
      entry("bob", "a", 50),
      entry("carol", "b", 100),
      entry("dave", "b", 75),
    ];
    const result = computeExplorePayout(entries, "a");
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(475);
  });

  it("equal stakes give equal shares", () => {
    // 100 on A each, 100 on B → total=300, each A winner gets 150
    const entries = [entry("alice", "a", 100), entry("bob", "a", 100), entry("carol", "b", 100)];
    const result = computeExplorePayout(entries, "a");
    expect(result.alice).toBe(150);
    expect(result.bob).toBe(150);
  });

  it("last winner absorbs integer remainder", () => {
    // total=100, 3 equal winners → floor(100/3)=33 twice, last gets 34
    const entries = [
      entry("alice", "a", 34),
      entry("bob", "a", 33),
      entry("carol", "a", 33),
    ];
    const result = computeExplorePayout(entries, "a");
    expect(result.alice + result.bob + result.carol).toBe(100);
  });

  it("returns correct winner when losing side has no entries", () => {
    const entries = [entry("alice", "a", 200), entry("bob", "a", 100)];
    const result = computeExplorePayout(entries, "a");
    // total=300, winner_total=300, alice gets floor(200/300*300)=200, bob gets 100
    expect(result.alice).toBe(200);
    expect(result.bob).toBe(100);
    expect(result.alice + result.bob).toBe(300);
  });
});

describe("computeExplorePayout — side B wins", () => {
  it("side B winners receive pot, side A loses", () => {
    const entries = [entry("alice", "a", 100), entry("bob", "b", 50), entry("carol", "b", 150)];
    const result = computeExplorePayout(entries, "b");
    // total=300, winner_total=200, bob: floor(50/200*300)=75, carol: 300-75=225
    expect(result.bob).toBe(75);
    expect(result.carol).toBe(225);
    expect(result.alice).toBeUndefined();
    expect(result.bob + result.carol).toBe(300);
  });
});
