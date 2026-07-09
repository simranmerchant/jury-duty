import { describe, it, expect } from "vitest";
import { canEditBet, canDeleteBet } from "../lib/bet-status";

// ─── canEditBet ────────────────────────────────────────────────────────────────

describe("canEditBet", () => {
  it("allows the creator to edit an open bet", () => {
    expect(canEditBet({ isCreator: true, isHost: false, status: "open" })).toBe(true);
  });

  it("allows the event host to edit an open bet", () => {
    expect(canEditBet({ isCreator: false, isHost: true, status: "open" })).toBe(true);
  });

  it("allows creator who is also host to edit", () => {
    expect(canEditBet({ isCreator: true, isHost: true, status: "open" })).toBe(true);
  });

  it("blocks a third party (not creator, not host)", () => {
    expect(canEditBet({ isCreator: false, isHost: false, status: "open" })).toBe(false);
  });

  it("blocks editing a resolved bet even for the creator", () => {
    expect(canEditBet({ isCreator: true, isHost: false, status: "resolved" })).toBe(false);
  });

  it("blocks editing a resolved bet even for the host", () => {
    expect(canEditBet({ isCreator: false, isHost: true, status: "resolved" })).toBe(false);
  });
});

// ─── canDeleteBet ──────────────────────────────────────────────────────────────

describe("canDeleteBet", () => {
  it("allows the creator to delete", () => {
    expect(canDeleteBet({ isCreator: true, isHost: false })).toBe(true);
  });

  it("allows the event host to delete", () => {
    expect(canDeleteBet({ isCreator: false, isHost: true })).toBe(true);
  });

  it("allows creator who is also host", () => {
    expect(canDeleteBet({ isCreator: true, isHost: true })).toBe(true);
  });

  it("blocks a third party", () => {
    expect(canDeleteBet({ isCreator: false, isHost: false })).toBe(false);
  });

  it("allows deletion regardless of bet status (resolved bets can be deleted)", () => {
    // status is not a parameter — canDeleteBet has no status constraint
    expect(canDeleteBet({ isCreator: true, isHost: false })).toBe(true);
  });
});
