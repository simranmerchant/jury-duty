import { describe, it, expect } from "vitest";
import { detectMention, insertMention } from "../lib/mention";

describe("detectMention", () => {
  it("returns null search when no @ present", () => {
    expect(detectMention("hello world", 11)).toEqual({ search: null, filter: "" });
  });

  it("detects a mention being typed", () => {
    const val = "who is @ja";
    expect(detectMention(val, val.length)).toEqual({ search: "ja", filter: "ja" });
  });

  it("returns search='' (empty string, not null) immediately after @", () => {
    const val = "hello @";
    expect(detectMention(val, val.length)).toEqual({ search: "", filter: "" });
  });

  it("stops detecting when a space follows the @ word (mention complete)", () => {
    const val = "@jake is ";
    // Cursor is after the space — mention is done
    expect(detectMention(val, val.length)).toEqual({ search: null, filter: "" });
  });

  it("detects mention at the @ word even when cursor is mid-word", () => {
    // Cursor after "ja" in "@jake"
    const val = "@jake";
    expect(detectMention(val, 3)).toEqual({ search: "ja", filter: "ja" });
  });

  it("uses the LAST @ before cursor, not the first", () => {
    // "@old mention @new" — cursor at end, should pick up "new"
    const val = "@oldmentioneduser blah @new";
    expect(detectMention(val, val.length)).toEqual({ search: "new", filter: "new" });
  });

  it("filter is always lowercase of search", () => {
    const val = "@Jake";
    expect(detectMention(val, val.length)).toEqual({ search: "Jake", filter: "jake" });
  });

  it("cursor before the @ means no mention", () => {
    const val = "@jake";
    // Cursor at position 0, before the @
    expect(detectMention(val, 0)).toEqual({ search: null, filter: "" });
  });
});

describe("insertMention", () => {
  it("replaces the @partial with @displayName", () => {
    const val = "who is @ja";
    const { newQuestion } = insertMention(val, val.length, "Jake");
    expect(newQuestion).toBe("who is @Jake");
  });

  it("preserves text after the cursor", () => {
    // Cursor in the middle: "who is @ja|kes around" — cursor after "ja"
    const val = "who is @jakes around";
    const { newQuestion } = insertMention(val, 10, "Jake");
    // Before @ = "who is ", name = "Jake", after cursor = "kes around"
    expect(newQuestion).toBe("who is @Jakekes around");
  });

  it("calculates correct new cursor position", () => {
    const val = "hello @ja";
    const { newCursor } = insertMention(val, val.length, "Jake");
    // "hello @Jake" — cursor after "Jake" = 7 + 1 + 4 = 12? No:
    // before = "hello " (6), @ (1), "Jake" (4) → cursor = 6 + 1 + 4 = 11
    expect(newCursor).toBe(11);
  });

  it("works when @ is at the start", () => {
    const val = "@si";
    const { newQuestion, newCursor } = insertMention(val, val.length, "Simran");
    expect(newQuestion).toBe("@Simran");
    expect(newCursor).toBe(7); // 0 + 1 + 6
  });

  it("inserts at the last @ when multiple @ signs exist", () => {
    const val = "@alice and @bo";
    const { newQuestion } = insertMention(val, val.length, "Bob");
    expect(newQuestion).toBe("@alice and @Bob");
  });
});
