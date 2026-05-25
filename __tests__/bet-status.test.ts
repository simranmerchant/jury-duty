import { describe, it, expect } from "vitest";
import { betPhase, canPlaceBet, canResolve } from "../lib/bet-status";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const PAST_OVER_24H = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

describe("betPhase", () => {
  it("returns 'resolved' when status is resolved, regardless of deadline", () => {
    expect(betPhase("resolved", FUTURE)).toBe("resolved");
    expect(betPhase("resolved", PAST)).toBe("resolved");
  });

  it("returns 'open' when status is open and deadline is in the future", () => {
    expect(betPhase("open", FUTURE)).toBe("open");
  });

  it("returns 'closed' when status is open and deadline is in the past", () => {
    expect(betPhase("open", PAST)).toBe("closed");
  });

  it("accepts a Date object as deadline", () => {
    expect(betPhase("open", new Date(Date.now() + 1000))).toBe("open");
    expect(betPhase("open", new Date(Date.now() - 1000))).toBe("closed");
  });
});

describe("canPlaceBet", () => {
  it("allows placing when phase is open and user has no entry", () => {
    expect(canPlaceBet("open", false)).toBe(true);
  });

  it("blocks placing when user already has an entry", () => {
    expect(canPlaceBet("open", true)).toBe(false);
  });

  it("blocks placing when bet is closed", () => {
    expect(canPlaceBet("closed", false)).toBe(false);
  });

  it("blocks placing when bet is resolved", () => {
    expect(canPlaceBet("resolved", false)).toBe(false);
  });
});

describe("canResolve", () => {
  it("creator can always resolve standalone bets", () => {
    expect(canResolve({ resolverIsCreator: true, eventId: null, deadline: PAST, resolverIsMember: false })).toBe(true);
  });

  it("creator can always resolve event bets", () => {
    expect(canResolve({ resolverIsCreator: true, eventId: "evt-1", deadline: FUTURE, resolverIsMember: false })).toBe(true);
  });

  it("non-creator cannot resolve standalone bets", () => {
    expect(canResolve({ resolverIsCreator: false, eventId: null, deadline: PAST, resolverIsMember: true })).toBe(false);
    expect(canResolve({ resolverIsCreator: false, eventId: null, deadline: PAST_OVER_24H, resolverIsMember: true })).toBe(false);
  });

  it("non-creator cannot resolve event bet before 24h post-deadline", () => {
    expect(canResolve({ resolverIsCreator: false, eventId: "evt-1", deadline: PAST, resolverIsMember: true })).toBe(false);
  });

  it("non-creator can resolve event bet after 24h if they are a member", () => {
    expect(canResolve({ resolverIsCreator: false, eventId: "evt-1", deadline: PAST_OVER_24H, resolverIsMember: true })).toBe(true);
  });

  it("non-member cannot resolve even after 24h", () => {
    expect(canResolve({ resolverIsCreator: false, eventId: "evt-1", deadline: PAST_OVER_24H, resolverIsMember: false })).toBe(false);
  });
});
