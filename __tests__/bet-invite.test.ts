import { describe, it, expect } from "vitest";
import { buildBetInviteUrl, validateBetJoinBody, isFeedBetAudience } from "../lib/bet-invite";

// ─── buildBetInviteUrl ────────────────────────────────────────────────────────

describe("buildBetInviteUrl", () => {
  it("builds a correct URL from base + token", () => {
    expect(buildBetInviteUrl("abc123", "https://juryduty.xyz"))
      .toBe("https://juryduty.xyz/join/bet/abc123");
  });

  it("strips a trailing slash from baseUrl", () => {
    expect(buildBetInviteUrl("abc123", "https://juryduty.xyz/"))
      .toBe("https://juryduty.xyz/join/bet/abc123");
  });

  it("works with a localhost base URL", () => {
    expect(buildBetInviteUrl("tok-xyz", "http://localhost:3000"))
      .toBe("http://localhost:3000/join/bet/tok-xyz");
  });

  it("preserves the token exactly as provided", () => {
    const token = "550e8400-e29b-41d4-a716-446655440000";
    expect(buildBetInviteUrl(token, "https://juryduty.xyz"))
      .toContain(token);
  });

  it("places the token at the end of the path", () => {
    const url = buildBetInviteUrl("mytoken", "https://juryduty.xyz");
    expect(url.endsWith("/join/bet/mytoken")).toBe(true);
  });
});

// ─── validateBetJoinBody ──────────────────────────────────────────────────────

describe("validateBetJoinBody — valid inputs", () => {
  it("returns null for a valid invite_token string", () => {
    expect(validateBetJoinBody({ invite_token: "abc123" })).toBeNull();
  });

  it("returns null for a UUID-shaped token", () => {
    expect(validateBetJoinBody({ invite_token: "550e8400-e29b-41d4-a716-446655440000" })).toBeNull();
  });

  it("ignores extra fields on the body", () => {
    expect(validateBetJoinBody({ invite_token: "tok", extra: true })).toBeNull();
  });
});

describe("validateBetJoinBody — invalid inputs", () => {
  it("rejects null body", () => {
    expect(validateBetJoinBody(null)).toBe("invite_token required");
  });

  it("rejects undefined body", () => {
    expect(validateBetJoinBody(undefined)).toBe("invite_token required");
  });

  it("rejects a non-object body", () => {
    expect(validateBetJoinBody("string")).toBe("invite_token required");
  });

  it("rejects body with no invite_token field", () => {
    expect(validateBetJoinBody({})).toBe("invite_token required");
  });

  it("rejects null invite_token", () => {
    expect(validateBetJoinBody({ invite_token: null })).toBe("invite_token required");
  });

  it("rejects empty string invite_token", () => {
    expect(validateBetJoinBody({ invite_token: "" })).toBe("invite_token required");
  });

  it("rejects whitespace-only invite_token", () => {
    expect(validateBetJoinBody({ invite_token: "   " })).toBe("invite_token required");
  });

  it("rejects a numeric invite_token", () => {
    expect(validateBetJoinBody({ invite_token: 12345 })).toBe("invite_token required");
  });

  it("rejects a boolean invite_token", () => {
    expect(validateBetJoinBody({ invite_token: true })).toBe("invite_token required");
  });
});

// ─── isFeedBetAudience ────────────────────────────────────────────────────────

describe("isFeedBetAudience", () => {
  it("returns true for 'followers'", () => {
    expect(isFeedBetAudience("followers")).toBe(true);
  });

  it("returns false for 'private'", () => {
    expect(isFeedBetAudience("private")).toBe(false);
  });

  it("returns false for 'select_people'", () => {
    expect(isFeedBetAudience("select_people")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFeedBetAudience("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isFeedBetAudience(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFeedBetAudience(undefined)).toBe(false);
  });

  it("is case-sensitive — rejects 'Followers'", () => {
    expect(isFeedBetAudience("Followers")).toBe(false);
  });
});
