import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateCreateBet } from "../lib/standalone-bet";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();

function valid(overrides: Record<string, unknown> = {}) {
  return { question: "who leaves first?", options: ["yes", "no"], deadline: FUTURE, ...overrides };
}

describe("validateCreateBet", () => {
  describe("question", () => {
    it("accepts a valid question", () => {
      expect(validateCreateBet(valid())).toEqual({ ok: true });
    });

    it("rejects missing question", () => {
      const r = validateCreateBet(valid({ question: "" }));
      expect(r).toMatchObject({ ok: false });
    });

    it("rejects whitespace-only question", () => {
      expect(validateCreateBet(valid({ question: "   " }))).toMatchObject({ ok: false });
    });

    it("rejects question over 200 chars", () => {
      expect(validateCreateBet(valid({ question: "a".repeat(201) }))).toMatchObject({ ok: false });
    });

    it("accepts question exactly 200 chars", () => {
      expect(validateCreateBet(valid({ question: "a".repeat(200) }))).toEqual({ ok: true });
    });

    it("rejects non-string question", () => {
      expect(validateCreateBet(valid({ question: 42 }))).toMatchObject({ ok: false });
    });
  });

  describe("options", () => {
    it("rejects fewer than 2 options", () => {
      expect(validateCreateBet(valid({ options: ["only one"] }))).toMatchObject({ ok: false });
    });

    it("accepts exactly 2 options", () => {
      expect(validateCreateBet(valid({ options: ["yes", "no"] }))).toEqual({ ok: true });
    });

    it("accepts up to 6 options", () => {
      expect(validateCreateBet(valid({ options: ["a", "b", "c", "d", "e", "f"] }))).toEqual({ ok: true });
    });

    it("rejects more than 6 options", () => {
      expect(validateCreateBet(valid({ options: ["a", "b", "c", "d", "e", "f", "g"] }))).toMatchObject({ ok: false });
    });

    it("rejects options with empty labels", () => {
      expect(validateCreateBet(valid({ options: ["yes", ""] }))).toMatchObject({ ok: false });
    });

    it("rejects option label over 100 chars", () => {
      expect(validateCreateBet(valid({ options: ["yes", "a".repeat(101)] }))).toMatchObject({ ok: false });
    });

    it("accepts option label exactly 100 chars", () => {
      expect(validateCreateBet(valid({ options: ["yes", "a".repeat(100)] }))).toEqual({ ok: true });
    });

    it("accepts object-shaped options with label field", () => {
      expect(validateCreateBet(valid({ options: [{ label: "yes" }, { label: "no" }] }))).toEqual({ ok: true });
    });

    it("rejects object options with empty label", () => {
      expect(validateCreateBet(valid({ options: [{ label: "" }, { label: "no" }] }))).toMatchObject({ ok: false });
    });

    it("rejects non-array options", () => {
      expect(validateCreateBet(valid({ options: "yes,no" }))).toMatchObject({ ok: false });
    });
  });

  describe("deadline", () => {
    it("rejects missing deadline", () => {
      expect(validateCreateBet(valid({ deadline: "" }))).toMatchObject({ ok: false });
      expect(validateCreateBet(valid({ deadline: null }))).toMatchObject({ ok: false });
    });

    it("rejects past deadline", () => {
      expect(validateCreateBet(valid({ deadline: PAST }))).toMatchObject({ ok: false });
    });

    it("rejects invalid date string", () => {
      expect(validateCreateBet(valid({ deadline: "not-a-date" }))).toMatchObject({ ok: false });
    });

    it("accepts future deadline", () => {
      expect(validateCreateBet(valid({ deadline: FUTURE }))).toEqual({ ok: true });
    });
  });
});
