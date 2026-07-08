import { describe, it, expect } from "vitest";
import { detectMention, extractMentions, insertMention } from "../lib/mention";

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

describe("extractMentions", () => {
  it("returns empty array for empty string", () => {
    expect(extractMentions("")).toEqual([]);
  });

  it("returns empty array when no mentions present", () => {
    expect(extractMentions("no tags here just words")).toEqual([]);
  });

  it("extracts a single mention", () => {
    expect(extractMentions("great game @simran")).toEqual(["simran"]);
  });

  it("extracts multiple distinct mentions", () => {
    expect(extractMentions("@alice and @bob both called it")).toEqual(["alice", "bob"]);
  });

  it("extracts a mention at the start of the string", () => {
    expect(extractMentions("@jake was right")).toEqual(["jake"]);
  });

  it("extracts a mention at the end of the string", () => {
    expect(extractMentions("congrats @taylor")).toEqual(["taylor"]);
  });

  it("preserves the original casing of usernames", () => {
    expect(extractMentions("hey @Jake")).toEqual(["Jake"]);
  });

  it("preserves duplicate mentions", () => {
    expect(extractMentions("@sam and @sam again")).toEqual(["sam", "sam"]);
  });

  it("handles mentions with numbers in the username", () => {
    expect(extractMentions("shoutout @user123")).toEqual(["user123"]);
  });

  it("ignores a lone @ with no word after it", () => {
    expect(extractMentions("email me @ work")).toEqual([]);
  });

  it("stops the mention at punctuation (period after username)", () => {
    const result = extractMentions("thanks @alex. you were right");
    expect(result).toEqual(["alex"]);
  });

  it("stops the mention at punctuation (comma after username)", () => {
    const result = extractMentions("@mike, you called it");
    expect(result).toEqual(["mike"]);
  });

  it("handles mentions separated by newlines", () => {
    expect(extractMentions("@alice\n@bob")).toEqual(["alice", "bob"]);
  });

  it("returns empty array for caption with only whitespace", () => {
    expect(extractMentions("   ")).toEqual([]);
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
