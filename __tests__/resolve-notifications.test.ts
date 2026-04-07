import { describe, it, expect } from "vitest";
import { buildResolveNotifications } from "../lib/resolve-notifications";

const BET_ID = "bet-123";
const QUESTION = "who leaves first?";

const ENTRY_A = { user_id: "user-a", option_id: "opt-1" };
const ENTRY_B = { user_id: "user-b", option_id: "opt-2" };
const ENTRY_C = { user_id: "user-c", option_id: "opt-1" }; // same option as A

describe("buildResolveNotifications — with a winner", () => {
  it("marks the correct entry as won", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A, ENTRY_B], "opt-1");
    const noteA = notes.find((n) => n.user_id === "user-a")!;
    expect(noteA.type).toBe("bet_resolved_won");
    expect(noteA.title).toBe("jury's in — you won 🎉");
  });

  it("marks entries on the wrong option as lost", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A, ENTRY_B], "opt-1");
    const noteB = notes.find((n) => n.user_id === "user-b")!;
    expect(noteB.type).toBe("bet_resolved_lost");
    expect(noteB.title).toBe("jury's in — you lost 💀");
  });

  it("marks multiple entries on the winning option as won", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A, ENTRY_B, ENTRY_C], "opt-1");
    expect(notes.find((n) => n.user_id === "user-a")!.type).toBe("bet_resolved_won");
    expect(notes.find((n) => n.user_id === "user-c")!.type).toBe("bet_resolved_won");
    expect(notes.find((n) => n.user_id === "user-b")!.type).toBe("bet_resolved_lost");
  });

  it("includes the bet question in the body", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A], "opt-1");
    expect(notes[0].body).toContain(QUESTION);
  });

  it("attaches the bet_id to data", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A], "opt-1");
    expect(notes[0].data.bet_id).toBe(BET_ID);
  });

  it("returns one notification per entry", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A, ENTRY_B], "opt-1");
    expect(notes).toHaveLength(2);
  });
});

describe("buildResolveNotifications — refund (no winner)", () => {
  it("marks all entries as refunded when winningOptionId is null", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A, ENTRY_B], null);
    expect(notes.every((n) => n.type === "bet_resolved_refunded")).toBe(true);
  });

  it("uses the correct title and body for refunds", () => {
    const notes = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A], null);
    expect(notes[0].title).toBe("case dismissed");
    expect(notes[0].body).toContain("called off");
    expect(notes[0].body).toContain("refunded");
  });

  it("returns empty array when there are no entries", () => {
    expect(buildResolveNotifications(BET_ID, QUESTION, [], null)).toHaveLength(0);
    expect(buildResolveNotifications(BET_ID, QUESTION, [], "opt-1")).toHaveLength(0);
  });
});

describe("buildResolveNotifications — body content", () => {
  it("won body mentions 'you called it'", () => {
    const [note] = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_A], "opt-1");
    expect(note.body).toMatch(/you called it/);
  });

  it("lost body mentions 'the jury has spoken'", () => {
    const [note] = buildResolveNotifications(BET_ID, QUESTION, [ENTRY_B], "opt-1");
    expect(note.body).toMatch(/jury has spoken/);
  });
});
