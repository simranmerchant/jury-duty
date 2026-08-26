import { describe, it, expect } from "vitest";
import { normalizePhone, normalizePhones } from "../lib/contacts";

describe("normalizePhone", () => {
  it("normalizes a 10-digit US number to E.164", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });

  it("strips formatting from (555) 123-4567", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("strips dashes from 555-123-4567", () => {
    expect(normalizePhone("555-123-4567")).toBe("+15551234567");
  });

  it("handles 11-digit number starting with 1", () => {
    expect(normalizePhone("15551234567")).toBe("+15551234567");
  });

  it("passes through a number already in E.164 format", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });

  it("handles international number with +", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
  });

  it("handles spaced international number", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });

  it("returns null for a too-short number", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("returns null for non-numeric junk", () => {
    expect(normalizePhone("not-a-phone")).toBeNull();
  });
});

describe("normalizePhones", () => {
  it("returns deduplicated E.164 numbers", () => {
    const result = normalizePhones(["(555) 123-4567", "555-123-4567", "+15551234567"]);
    expect(result).toEqual(["+15551234567"]);
  });

  it("drops invalid entries and keeps valid ones", () => {
    const result = normalizePhones(["5551234567", "bad", null, 123, "+447911123456"]);
    expect(result).toContain("+15551234567");
    expect(result).toContain("+447911123456");
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(normalizePhones([])).toEqual([]);
  });

  it("drops non-string entries", () => {
    expect(normalizePhones([null, undefined, 42, true])).toEqual([]);
  });
});
