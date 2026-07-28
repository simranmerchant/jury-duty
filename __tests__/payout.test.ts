import { describe, it, expect } from "vitest";
import { computePayouts, calculateRefunds, type BetEntry } from "../lib/payout";

function entry(userId: string, optionId: string, staked: number): BetEntry {
  return { userId, optionId, staked };
}

describe("computePayouts — void (winningOptionId=null)", () => {
  it("refunds all entrants their own stake", () => {
    const entries = [entry("alice", "opt-a", 100), entry("bob", "opt-b", 200)];
    expect(computePayouts(entries, null)).toEqual({ alice: 100, bob: 200 });
  });

  it("refunds to empty map when there are no entries", () => {
    expect(computePayouts([], null)).toEqual({});
  });

  it("sums multiple stakes for the same user", () => {
    const entries = [entry("alice", "opt-a", 50), entry("alice", "opt-b", 75)];
    expect(computePayouts(entries, null)).toEqual({ alice: 125 });
  });
});

describe("computePayouts — no entries on winning side", () => {
  it("refunds everyone when nobody picked the winner", () => {
    const entries = [entry("alice", "opt-a", 100), entry("bob", "opt-a", 200)];
    expect(computePayouts(entries, "opt-b")).toEqual({ alice: 100, bob: 200 });
  });
});

describe("computePayouts — single winner takes pot", () => {
  it("winner receives full pot", () => {
    const entries = [entry("alice", "opt-a", 100), entry("bob", "opt-b", 200)];
    expect(computePayouts(entries, "opt-a")).toEqual({ alice: 300 });
  });

  it("winner with no losers still receives their stake", () => {
    const entries = [entry("alice", "opt-a", 100)];
    expect(computePayouts(entries, "opt-a")).toEqual({ alice: 100 });
  });
});

describe("computePayouts — multiple winners split pot", () => {
  it("splits pot evenly among winners", () => {
    // pot=300, 2 winners → 150 each
    const entries = [
      entry("alice", "opt-a", 100),
      entry("bob", "opt-a", 100),
      entry("carol", "opt-b", 100),
    ];
    expect(computePayouts(entries, "opt-a")).toEqual({ alice: 150, bob: 150 });
  });

  it("gives floor amount to each winner and remainder to first winner", () => {
    // pot=100, 3 winners → floor(100/3)=33 each, remainder=1 → first winner gets 34
    const entries = [
      entry("alice", "opt-a", 34),
      entry("bob", "opt-a", 33),
      entry("carol", "opt-a", 33),
    ];
    const result = computePayouts(entries, "opt-a");
    expect(result.alice).toBe(34);
    expect(result.bob).toBe(33);
    expect(result.carol).toBe(33);
    expect(result.alice + result.bob + result.carol).toBe(100);
  });

  it("total payout equals total pot", () => {
    const entries = [
      entry("alice", "opt-a", 250),
      entry("bob", "opt-a", 50),
      entry("carol", "opt-b", 100),
      entry("dave", "opt-b", 75),
    ];
    const result = computePayouts(entries, "opt-a");
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(475);
  });

  it("pot with exact remainder=0 splits cleanly", () => {
    // pot=200, 2 winners → 100 each
    const entries = [
      entry("alice", "opt-a", 100),
      entry("bob", "opt-a", 100),
    ];
    expect(computePayouts(entries, "opt-a")).toEqual({ alice: 100, bob: 100 });
  });
});

describe("computePayouts — proportional distribution", () => {
  it("larger staker receives proportionally more than smaller staker", () => {
    // pot=350, winner stakes=250 → alice floor(350*200/250)=280, bob floor(350*50/250)=70
    const entries = [
      entry("alice", "opt-a", 200),
      entry("bob", "opt-a", 50),
      entry("carol", "opt-b", 100),
    ];
    const result = computePayouts(entries, "opt-a");
    expect(result.alice).toBe(280);
    expect(result.bob).toBe(70);
    expect(result.carol).toBeUndefined();
    expect(result.alice + result.bob).toBe(350);
  });

  it("winner always receives at least their stake back when only losers oppose them", () => {
    // alice bets 200 on winning side; if payout were equal-split she'd get less
    // than her stake. Proportional ensures she always profits.
    const entries = [
      entry("alice", "opt-a", 200),
      entry("bob", "opt-a", 50),
      entry("carol", "opt-b", 150),
    ];
    const result = computePayouts(entries, "opt-a");
    // pot=400, winner stakes=250 → alice=floor(400*200/250)=320, bob=floor(400*50/250)=80
    expect(result.alice).toBe(320);
    expect(result.bob).toBe(80);
    expect(result.alice + result.bob).toBe(400);
    // alice staked 200, got 320 — net +120 ✓ (never loses points for winning)
    expect(result.alice).toBeGreaterThan(200);
  });
});

describe("computePayouts — edge cases", () => {
  it("handles empty entries array", () => {
    expect(computePayouts([], "opt-a")).toEqual({});
  });

  it("accumulates winnings when same user has multiple winning entries", () => {
    const entries = [
      entry("alice", "opt-a", 100),
      entry("alice", "opt-a", 50),
      entry("bob", "opt-b", 50),
    ];
    const result = computePayouts(entries, "opt-a");
    // pot=200, alice holds all winner stakes (150) → alice gets all 200
    expect(result.alice).toBe(200);
    expect(result.bob).toBeUndefined();
  });
});

// ─── calculateRefunds ──────────────────────────────────────────────────────────
// Used when a bet is deleted — every entrant gets their stake back.

describe("calculateRefunds", () => {
  it("returns empty object for no entries", () => {
    expect(calculateRefunds([])).toEqual({});
  });

  it("refunds each user their staked amount", () => {
    const entries = [
      { user_id: "alice", points_staked: 100 },
      { user_id: "bob", points_staked: 200 },
    ];
    expect(calculateRefunds(entries)).toEqual({ alice: 100, bob: 200 });
  });

  it("sums multiple stakes for the same user", () => {
    const entries = [
      { user_id: "alice", points_staked: 50 },
      { user_id: "alice", points_staked: 75 },
    ];
    expect(calculateRefunds(entries)).toEqual({ alice: 125 });
  });

  it("handles mixed users with multiple entries", () => {
    const entries = [
      { user_id: "alice", points_staked: 100 },
      { user_id: "bob", points_staked: 50 },
      { user_id: "alice", points_staked: 25 },
      { user_id: "carol", points_staked: 200 },
    ];
    expect(calculateRefunds(entries)).toEqual({ alice: 125, bob: 50, carol: 200 });
  });

  it("total refunded equals total staked", () => {
    const entries = [
      { user_id: "alice", points_staked: 100 },
      { user_id: "bob", points_staked: 150 },
      { user_id: "carol", points_staked: 75 },
    ];
    const result = calculateRefunds(entries);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(325);
  });
});
