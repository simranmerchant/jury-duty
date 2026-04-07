import { describe, it, expect } from "vitest";
import { canSubmit, tagOptionLabel, type BetFormState } from "../lib/bet-form";

// ─── canSubmit ────────────────────────────────────────────────────────────────

function baseState(overrides: Partial<BetFormState> = {}): BetFormState {
  return {
    question: "who leaves first?",
    options: [{ label: "Jake" }, { label: "Maya" }],
    isGroup: false,
    deadline: "",
    ...overrides,
  };
}

describe("canSubmit", () => {
  it("returns true for a valid public event bet", () => {
    expect(canSubmit(baseState())).toBe(true);
  });

  it("returns false when question is empty", () => {
    expect(canSubmit(baseState({ question: "" }))).toBe(false);
    expect(canSubmit(baseState({ question: "   " }))).toBe(false);
  });

  it("returns false when question exceeds 200 chars", () => {
    expect(canSubmit(baseState({ question: "a".repeat(201) }))).toBe(false);
    expect(canSubmit(baseState({ question: "a".repeat(200) }))).toBe(true);
  });

  it("returns false when fewer than 2 filled options", () => {
    expect(canSubmit(baseState({ options: [{ label: "Jake" }] }))).toBe(false);
    expect(canSubmit(baseState({ options: [{ label: "" }, { label: "" }] }))).toBe(false);
  });

  it("counts tagged options (no label) as filled", () => {
    expect(
      canSubmit(baseState({ options: [{ label: "", tagged_user_id: "user-1" }, { label: "Maya" }] }))
    ).toBe(true);
  });

  it("returns false when any option label exceeds 100 chars", () => {
    expect(
      canSubmit(baseState({ options: [{ label: "a".repeat(101) }, { label: "Maya" }] }))
    ).toBe(false);
    expect(
      canSubmit(baseState({ options: [{ label: "a".repeat(100) }, { label: "Maya" }] }))
    ).toBe(true);
  });

  it("returns false for a group bet with no deadline", () => {
    expect(canSubmit(baseState({ isGroup: true, deadline: "" }))).toBe(false);
  });

  it("returns true for a group bet with a deadline", () => {
    expect(canSubmit(baseState({ isGroup: true, deadline: "2026-12-31T23:59" }))).toBe(true);
  });

  it("does not require deadline for non-group bets", () => {
    expect(canSubmit(baseState({ isGroup: false, deadline: "" }))).toBe(true);
  });

  it("returns false when an option has neither label nor tagged_user_id", () => {
    // 3 options but one is completely empty
    expect(
      canSubmit(
        baseState({ options: [{ label: "Jake" }, { label: "Maya" }, { label: "" }] })
      )
    ).toBe(false);
  });
});

// ─── tagOptionLabel ───────────────────────────────────────────────────────────

describe("tagOptionLabel", () => {
  it("returns display_name when available", () => {
    expect(tagOptionLabel("Jake Smith", "jakesmith")).toBe("Jake Smith");
  });

  it("falls back to username when display_name is null", () => {
    expect(tagOptionLabel(null, "jakesmith")).toBe("jakesmith");
  });

  it("falls back to username when display_name is undefined", () => {
    expect(tagOptionLabel(undefined, "jakesmith")).toBe("jakesmith");
  });

  it("falls back to '?' when both are null", () => {
    expect(tagOptionLabel(null, null)).toBe("?");
  });

  it("falls back to '?' when both are undefined", () => {
    expect(tagOptionLabel(undefined, undefined)).toBe("?");
  });

  it("uses display_name even if username is also present", () => {
    expect(tagOptionLabel("Jake", "jakesmith")).toBe("Jake");
  });
});
