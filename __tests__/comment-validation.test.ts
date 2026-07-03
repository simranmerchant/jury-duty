import { validateComment } from "../lib/comment-validation";

describe("validateComment — missing content", () => {
  it("rejects when body and gif_url are both absent", () => {
    const r = validateComment(undefined, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("comment or gif required");
  });

  it("rejects when body is empty string and gif_url is absent", () => {
    const r = validateComment("", undefined);
    expect(r.ok).toBe(false);
  });

  it("rejects when body is whitespace-only and gif_url is absent", () => {
    const r = validateComment("   ", undefined);
    expect(r.ok).toBe(false);
  });

  it("rejects when body is null and gif_url is absent", () => {
    const r = validateComment(null, undefined);
    expect(r.ok).toBe(false);
  });

  it("rejects when body is absent and gif_url is empty string", () => {
    const r = validateComment(undefined, "");
    expect(r.ok).toBe(false);
  });
});

describe("validateComment — valid content", () => {
  it("accepts a plain text body", () => {
    const r = validateComment("hello", undefined);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toBe("hello");
      expect(r.gif_url).toBeUndefined();
    }
  });

  it("trims leading and trailing whitespace from body", () => {
    const r = validateComment("  hi there  ", undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toBe("hi there");
  });

  it("accepts a gif_url with no body", () => {
    const r = validateComment(undefined, "https://media.giphy.com/abc.gif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.gif_url).toBe("https://media.giphy.com/abc.gif");
      expect(r.body).toBeUndefined();
    }
  });

  it("accepts both body and gif_url together", () => {
    const r = validateComment("nice", "https://media.giphy.com/abc.gif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toBe("nice");
      expect(r.gif_url).toBe("https://media.giphy.com/abc.gif");
    }
  });

  it("accepts a body of exactly 500 characters", () => {
    const r = validateComment("a".repeat(500), undefined);
    expect(r.ok).toBe(true);
  });
});

describe("validateComment — body length", () => {
  it("rejects a body longer than 500 characters", () => {
    const r = validateComment("a".repeat(501), undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("max 500 chars");
  });

  it("body length is checked after trimming", () => {
    // 500 chars of content padded with spaces — trims to 500, should pass
    const r = validateComment("  " + "a".repeat(500) + "  ", undefined);
    expect(r.ok).toBe(true);
  });

  it("rejects when trimmed body is over 500 chars even with gif", () => {
    const r = validateComment("a".repeat(501), "https://media.giphy.com/abc.gif");
    expect(r.ok).toBe(false);
  });
});

describe("validateComment — type coercion edge cases", () => {
  it("rejects non-string body (number)", () => {
    const r = validateComment(42, undefined);
    expect(r.ok).toBe(false);
  });

  it("rejects non-string gif_url (number)", () => {
    const r = validateComment(undefined, 42);
    expect(r.ok).toBe(false);
  });

  it("body with only whitespace + valid gif is accepted (gif wins)", () => {
    const r = validateComment("   ", "https://media.giphy.com/abc.gif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toBeUndefined();
      expect(r.gif_url).toBe("https://media.giphy.com/abc.gif");
    }
  });
});
