import { describe, it, expect } from "vitest";
import { isValidUsername, normalizeUsername, USERNAME_RE } from "../lib/username";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  Jake  ")).toBe("jake");
    expect(normalizeUsername("SIMRAN")).toBe("simran");
  });
});

describe("USERNAME_RE / isValidUsername", () => {
  // Valid cases
  it("accepts exactly 3 alphanumeric chars", () => {
    expect(isValidUsername("abc")).toBe(true);
    expect(isValidUsername("a1b")).toBe(true);
  });

  it("accepts handles with dots and underscores in the middle", () => {
    expect(isValidUsername("jake.smith")).toBe(true);
    expect(isValidUsername("jake_smith")).toBe(true);
    expect(isValidUsername("jake.smith_123")).toBe(true);
  });

  it("accepts handles up to 20 chars", () => {
    expect(isValidUsername("abcdefghij1234567890")).toBe(true); // 20 chars
  });

  // Invalid cases
  it("rejects handles shorter than 3 chars", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a")).toBe(false);
    expect(isValidUsername("")).toBe(false);
  });

  it("rejects handles longer than 20 chars", () => {
    expect(isValidUsername("abcdefghij12345678901")).toBe(false); // 21 chars
  });

  it("rejects handles starting with a dot or underscore", () => {
    expect(isValidUsername(".jake")).toBe(false);
    expect(isValidUsername("_jake")).toBe(false);
  });

  it("rejects handles ending with a dot or underscore", () => {
    expect(isValidUsername("jake.")).toBe(false);
    expect(isValidUsername("jake_")).toBe(false);
  });

  it("rejects handles with uppercase letters (regex is case-sensitive)", () => {
    expect(USERNAME_RE.test("Jake")).toBe(false);
    expect(USERNAME_RE.test("JAKE")).toBe(false);
  });

  it("rejects handles with special characters", () => {
    expect(isValidUsername("jake!smith")).toBe(false);
    expect(isValidUsername("jake@smith")).toBe(false);
    expect(isValidUsername("jake smith")).toBe(false);
  });

  it("normalizeUsername + isValidUsername handles uppercase input", () => {
    // The route lowercases before checking — simulate that
    expect(isValidUsername(normalizeUsername("Jake"))).toBe(true);
    expect(isValidUsername(normalizeUsername("SIMRAN99"))).toBe(true);
  });
});
