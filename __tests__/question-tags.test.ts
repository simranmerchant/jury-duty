import { parseQuestion, extractTaggedUserIds, insertMentionAt, removeMention, getWordTokens } from "../lib/question-tags";

describe("parseQuestion", () => {
  it("returns single text segment for plain question", () => {
    const segs = parseQuestion("Will John win?");
    expect(segs).toEqual([{ type: "text", text: "Will John win?", start: 0, end: 14 }]);
  });

  it("parses a mention token correctly", () => {
    const q = "Will @[uid123|John] win?";
    const segs = parseQuestion(q);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ type: "text", text: "Will ", start: 0, end: 5 });
    expect(segs[1]).toEqual({ type: "mention", userId: "uid123", original: "John", start: 5, end: 19 });
    expect(segs[2]).toEqual({ type: "text", text: " win?", start: 19, end: 24 });
  });

  it("handles multiple mentions", () => {
    const q = "@[u1|Alice] vs @[u2|Bob]";
    const segs = parseQuestion(q);
    expect(segs.filter((s) => s.type === "mention")).toHaveLength(2);
  });

  it("returns empty array for empty string", () => {
    expect(parseQuestion("")).toEqual([]);
  });
});

describe("extractTaggedUserIds", () => {
  it("extracts no ids from plain text", () => {
    expect(extractTaggedUserIds("Will John win?")).toEqual([]);
  });

  it("extracts user ids from tokens", () => {
    expect(extractTaggedUserIds("@[u1|Alice] vs @[u2|Bob]")).toEqual(["u1", "u2"]);
  });
});

describe("insertMentionAt", () => {
  it("replaces a word with a mention token", () => {
    const q = "Will John win?";
    const result = insertMentionAt(q, 5, 9, "uid123");
    expect(result).toBe("Will @[uid123|John] win?");
  });

  it("handles replacement at start", () => {
    const result = insertMentionAt("John wins", 0, 4, "uid1");
    expect(result).toBe("@[uid1|John] wins");
  });

  it("handles replacement at end", () => {
    const result = insertMentionAt("Bet on John", 7, 11, "uid1");
    expect(result).toBe("Bet on @[uid1|John]");
  });
});

describe("removeMention", () => {
  it("restores original word", () => {
    const q = "Will @[uid123|John] win?";
    expect(removeMention(q, "uid123")).toBe("Will John win?");
  });

  it("removes only the matching user", () => {
    const q = "@[u1|Alice] beats @[u2|Bob]";
    expect(removeMention(q, "u1")).toBe("Alice beats @[u2|Bob]");
  });

  it("is a no-op if userId not found", () => {
    const q = "Will John win?";
    expect(removeMention(q, "nobody")).toBe("Will John win?");
  });
});

describe("getWordTokens", () => {
  it("splits plain text into words", () => {
    const segs = parseQuestion("Will John win?");
    const tokens = getWordTokens(segs);
    expect(tokens.map((t) => t.label)).toEqual(["Will", "John", "win?"]);
    expect(tokens.every((t) => !t.isMention)).toBe(true);
  });

  it("keeps mentions as single non-tappable tokens", () => {
    const segs = parseQuestion("Will @[uid|John] win?");
    const tokens = getWordTokens(segs);
    expect(tokens).toHaveLength(3);
    expect(tokens[1]).toMatchObject({ label: "@John", isMention: true, userId: "uid" });
  });
});
