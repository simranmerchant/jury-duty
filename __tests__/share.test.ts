import { describe, it, expect } from "vitest";
import { isPostVisibleToUser, validateShareBody, validatePostUpdate } from "../lib/share";

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

// ─── validatePostUpdate ───────────────────────────────────────────────────────

describe("validatePostUpdate — caption", () => {
  it("accepts null caption", () => {
    expect(validatePostUpdate({ caption: null })).toBeNull();
  });

  it("accepts undefined caption (field omitted)", () => {
    expect(validatePostUpdate({})).toBeNull();
  });

  it("accepts valid caption string", () => {
    expect(validatePostUpdate({ caption: "looks good!" })).toBeNull();
  });

  it("accepts caption exactly 280 chars", () => {
    expect(validatePostUpdate({ caption: "a".repeat(280) })).toBeNull();
  });

  it("rejects caption over 280 chars", () => {
    expect(validatePostUpdate({ caption: "a".repeat(281) })).toBe("caption too long");
  });

  it("rejects non-string caption (number)", () => {
    expect(validatePostUpdate({ caption: 42 })).toBe("caption must be a string");
  });

  it("rejects non-string caption (boolean)", () => {
    expect(validatePostUpdate({ caption: true })).toBe("caption must be a string");
  });

  it("rejects non-string caption (object)", () => {
    expect(validatePostUpdate({ caption: {} })).toBe("caption must be a string");
  });
});

describe("validatePostUpdate — photo_url", () => {
  it("accepts string photo_url", () => {
    expect(validatePostUpdate({ photo_url: "https://example.com/img.jpg" })).toBeNull();
  });

  it("accepts null photo_url (remove photo)", () => {
    expect(validatePostUpdate({ photo_url: null })).toBeNull();
  });

  it("accepts undefined photo_url (not changed)", () => {
    expect(validatePostUpdate({})).toBeNull();
  });

  it("rejects numeric photo_url", () => {
    expect(validatePostUpdate({ photo_url: 123 })).toBe("invalid photo_url");
  });

  it("rejects object photo_url", () => {
    expect(validatePostUpdate({ photo_url: { url: "x" } })).toBe("invalid photo_url");
  });
});

describe("validatePostUpdate — combined", () => {
  it("accepts both fields valid", () => {
    expect(validatePostUpdate({ caption: "new caption", photo_url: "https://example.com/new.jpg" })).toBeNull();
  });

  it("caption error takes precedence over photo_url", () => {
    expect(validatePostUpdate({ caption: "a".repeat(281), photo_url: 123 })).toBe("caption too long");
  });

  it("reports photo_url error when caption is valid", () => {
    expect(validatePostUpdate({ caption: "fine", photo_url: 123 })).toBe("invalid photo_url");
  });

  it("accepts clearing both fields (null, null)", () => {
    expect(validatePostUpdate({ caption: null, photo_url: null })).toBeNull();
  });
});
