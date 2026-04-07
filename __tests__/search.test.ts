import { describe, it, expect } from "vitest";
import { sanitizeSearchQuery } from "../lib/search";

describe("sanitizeSearchQuery", () => {
  it("strips leading @ so @handle works like handle", () => {
    expect(sanitizeSearchQuery("@jake")).toBe("jake");
    expect(sanitizeSearchQuery("@simran99")).toBe("simran99");
  });

  it("does not strip @ in the middle of a query (only leading @ is removed)", () => {
    expect(sanitizeSearchQuery("jake@smith")).toBe("jake@smith");
  });

  it("leaves normal queries unchanged", () => {
    expect(sanitizeSearchQuery("jake")).toBe("jake");
    expect(sanitizeSearchQuery("simran")).toBe("simran");
  });

  // PostgREST injection prevention
  it("strips commas (splits conditions in PostgREST .or() filter)", () => {
    expect(sanitizeSearchQuery("a,b")).toBe("ab");
    expect(sanitizeSearchQuery("jake,username.eq.other")).toBe("jakeusernameeqother");
  });

  it("strips dots", () => {
    expect(sanitizeSearchQuery("username.eq.jake")).toBe("usernameeqjake");
  });

  it("strips parentheses", () => {
    expect(sanitizeSearchQuery("(inject)")).toBe("inject");
  });

  it("strips double quotes", () => {
    expect(sanitizeSearchQuery('say "hi"')).toBe("say hi");
  });

  it("handles combined injection attempt", () => {
    // Attempt: close the ilike filter and inject a new condition
    const malicious = 'x%,username.eq."admin"';
    const safe = sanitizeSearchQuery(malicious);
    expect(safe).not.toContain(",");
    expect(safe).not.toContain(".");
    expect(safe).not.toContain('"');
    expect(safe).not.toContain("(");
    expect(safe).not.toContain(")");
  });

  it("preserves spaces, hyphens, numbers (valid search chars)", () => {
    expect(sanitizeSearchQuery("john doe")).toBe("john doe");
    expect(sanitizeSearchQuery("user-123")).toBe("user-123");
  });
});
