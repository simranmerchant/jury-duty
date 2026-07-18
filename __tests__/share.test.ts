import { describe, it, expect } from "vitest";
import { isPostVisibleToUser, validateShareBody } from "../lib/share";

// ─── isPostVisibleToUser ───────────────────────────────────────────────────────

describe("isPostVisibleToUser", () => {
  it("null targeted_user_ids is visible to everyone", () => {
    expect(isPostVisibleToUser(null, "user-1")).toBe(true);
  });

  it("undefined targeted_user_ids is visible to everyone", () => {
    expect(isPostVisibleToUser(undefined, "user-1")).toBe(true);
  });

  it("empty array is visible to everyone", () => {
    expect(isPostVisibleToUser([], "user-1")).toBe(true);
  });

  it("returns true when viewer is in the list", () => {
    expect(isPostVisibleToUser(["user-1", "user-2"], "user-1")).toBe(true);
  });

  it("returns false when viewer is not in the list", () => {
    expect(isPostVisibleToUser(["user-2", "user-3"], "user-1")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isPostVisibleToUser(["User-1"], "user-1")).toBe(false);
  });

  it("single-element list visible to that user", () => {
    expect(isPostVisibleToUser(["only-me"], "only-me")).toBe(true);
  });

  it("single-element list not visible to others", () => {
    expect(isPostVisibleToUser(["only-me"], "someone-else")).toBe(false);
  });
});

// ─── validateShareBody ────────────────────────────────────────────────────────

describe("validateShareBody — caption", () => {
  it("accepts null caption", () => {
    expect(validateShareBody({ caption: null })).toBeNull();
  });

  it("accepts undefined caption", () => {
    expect(validateShareBody({})).toBeNull();
  });

  it("accepts valid caption", () => {
    expect(validateShareBody({ caption: "great bet!" })).toBeNull();
  });

  it("accepts caption exactly 280 chars", () => {
    expect(validateShareBody({ caption: "a".repeat(280) })).toBeNull();
  });

  it("rejects caption over 280 chars", () => {
    expect(validateShareBody({ caption: "a".repeat(281) })).toBe("caption too long");
  });

  it("rejects non-string caption", () => {
    expect(validateShareBody({ caption: 42 })).toBe("caption must be a string");
  });
});

describe("validateShareBody — photo_url", () => {
  it("accepts string photo_url", () => {
    expect(validateShareBody({ photo_url: "https://example.com/img.jpg" })).toBeNull();
  });

  it("accepts null photo_url", () => {
    expect(validateShareBody({ photo_url: null })).toBeNull();
  });

  it("accepts undefined photo_url", () => {
    expect(validateShareBody({})).toBeNull();
  });

  it("rejects non-string photo_url", () => {
    expect(validateShareBody({ photo_url: 123 })).toBe("invalid photo_url");
  });

  it("rejects object photo_url", () => {
    expect(validateShareBody({ photo_url: {} })).toBe("invalid photo_url");
  });
});

describe("validateShareBody — targeted_user_ids", () => {
  it("accepts undefined (null = all followers)", () => {
    expect(validateShareBody({})).toBeNull();
  });

  it("accepts empty array", () => {
    expect(validateShareBody({ targeted_user_ids: [] })).toBeNull();
  });

  it("accepts array of strings", () => {
    expect(validateShareBody({ targeted_user_ids: ["a", "b"] })).toBeNull();
  });

  it("rejects non-array targeted_user_ids", () => {
    expect(validateShareBody({ targeted_user_ids: "user-1" })).toBe("targeted_user_ids must be an array");
  });

  it("rejects array containing empty string", () => {
    expect(validateShareBody({ targeted_user_ids: ["user-1", ""] })).toBe("targeted_user_ids must contain non-empty strings");
  });

  it("rejects array containing non-string", () => {
    expect(validateShareBody({ targeted_user_ids: ["user-1", 42] })).toBe("targeted_user_ids must contain non-empty strings");
  });
});
