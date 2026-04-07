import { describe, it, expect } from "vitest";
import { generateInviteToken, verifyInviteToken } from "../lib/invite";

describe("generateInviteToken", () => {
  it("returns a 32-char hex string", () => {
    const token = generateInviteToken("event-123");
    expect(token).toHaveLength(32);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it("is deterministic for the same eventId", () => {
    expect(generateInviteToken("event-abc")).toBe(generateInviteToken("event-abc"));
  });

  it("produces different tokens for different event IDs", () => {
    expect(generateInviteToken("event-a")).not.toBe(generateInviteToken("event-b"));
  });
});

describe("verifyInviteToken", () => {
  it("accepts a valid token", () => {
    const eventId = "event-xyz";
    const token = generateInviteToken(eventId);
    expect(verifyInviteToken(eventId, token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const eventId = "event-xyz";
    const token = generateInviteToken(eventId);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyInviteToken(eventId, tampered)).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(verifyInviteToken("event-xyz", "")).toBe(false);
  });

  it("rejects a token for a different event", () => {
    const tokenForA = generateInviteToken("event-a");
    expect(verifyInviteToken("event-b", tokenForA)).toBe(false);
  });

  it("rejects a token that is too short (length mismatch returns false immediately)", () => {
    const token = generateInviteToken("event-xyz");
    expect(verifyInviteToken("event-xyz", token.slice(0, 10))).toBe(false);
  });

  it("rejects a token that is too long", () => {
    const token = generateInviteToken("event-xyz");
    expect(verifyInviteToken("event-xyz", token + "ab")).toBe(false);
  });

  it("roundtrip: generate then verify succeeds for multiple events", () => {
    for (const id of ["abc", "uuid-1234", "event with spaces", ""]) {
      const token = generateInviteToken(id);
      expect(verifyInviteToken(id, token)).toBe(true);
    }
  });
});
