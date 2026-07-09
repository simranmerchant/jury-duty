import { describe, it, expect } from "vitest";
import { hasUnvotedOpen, hasNewBets, type BetForEvent } from "../lib/events";

const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();
const NOW = new Date();

function bet(overrides: Partial<BetForEvent> & { bet_entries?: { user_id: string }[] } = {}): BetForEvent {
  return {
    status: "open",
    creator_id: "other-user",
    created_at: new Date(Date.now() - 1000).toISOString(),
    deadline: FUTURE,
    bet_entries: [],
    ...overrides,
  };
}

// ─── hasUnvotedOpen ────────────────────────────────────────────────────────────

describe("hasUnvotedOpen", () => {
  it("returns true when there is an open bet the user hasn't voted on", () => {
    const bets = [bet()];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(true);
  });

  it("returns false when the user already voted on all open bets", () => {
    const bets = [bet({ bet_entries: [{ user_id: "alice" }] })];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(false);
  });

  it("returns false when the only open bet was created by the user (own bet excluded)", () => {
    const bets = [bet({ creator_id: "alice" })];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(false);
  });

  it("returns false when the bet deadline is in the past", () => {
    const bets = [bet({ deadline: PAST })];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(false);
  });

  it("returns false when the bet is resolved", () => {
    const bets = [bet({ status: "resolved" })];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(false);
  });

  it("returns false when there are no bets", () => {
    expect(hasUnvotedOpen([], "alice", NOW)).toBe(false);
  });

  it("returns true when at least one of many bets is unvoted and not own", () => {
    const bets = [
      bet({ creator_id: "alice" }),                           // own — excluded
      bet({ bet_entries: [{ user_id: "alice" }] }),           // already voted
      bet({ deadline: PAST }),                                 // past deadline
      bet(),                                                   // ← this one qualifies
    ];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(true);
  });

  it("is unaffected by other users' entries on the same bet", () => {
    const bets = [bet({ bet_entries: [{ user_id: "bob" }] })];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(true);
  });

  it("returns false when all qualifying bets are own bets", () => {
    const bets = [
      bet({ creator_id: "alice" }),
      bet({ creator_id: "alice", deadline: FUTURE }),
    ];
    expect(hasUnvotedOpen(bets, "alice", NOW)).toBe(false);
  });
});

// ─── hasNewBets ────────────────────────────────────────────────────────────────

describe("hasNewBets", () => {
  it("returns true when seenAt is undefined and there is a bet from someone else", () => {
    expect(hasNewBets([bet()], "alice", undefined)).toBe(true);
  });

  it("returns false when all bets are from the current user", () => {
    const bets = [bet({ creator_id: "alice" })];
    expect(hasNewBets(bets, "alice", undefined)).toBe(false);
  });

  it("returns false when there are no bets", () => {
    expect(hasNewBets([], "alice", undefined)).toBe(false);
  });

  it("returns true when a bet was created after seenAt", () => {
    const seenAt = new Date(Date.now() - 5000).toISOString();
    const recentBet = bet({ created_at: new Date(Date.now() - 1000).toISOString() });
    expect(hasNewBets([recentBet], "alice", seenAt)).toBe(true);
  });

  it("returns false when all bets were created before seenAt", () => {
    const seenAt = new Date(Date.now() - 1000).toISOString();
    const oldBet = bet({ created_at: new Date(Date.now() - 5000).toISOString() });
    expect(hasNewBets([oldBet], "alice", seenAt)).toBe(false);
  });

  it("ignores own bets regardless of created_at vs seenAt", () => {
    const seenAt = new Date(Date.now() - 5000).toISOString();
    const ownBet = bet({ creator_id: "alice", created_at: new Date(Date.now() - 1000).toISOString() });
    expect(hasNewBets([ownBet], "alice", seenAt)).toBe(false);
  });

  it("returns true when at least one of multiple bets is new from another user", () => {
    const seenAt = new Date(Date.now() - 5000).toISOString();
    const bets = [
      bet({ creator_id: "alice", created_at: new Date(Date.now() - 1000).toISOString() }), // own
      bet({ created_at: new Date(Date.now() - 8000).toISOString() }),                       // before seenAt
      bet({ created_at: new Date(Date.now() - 1000).toISOString() }),                       // ← new from other
    ];
    expect(hasNewBets(bets, "alice", seenAt)).toBe(true);
  });
});
