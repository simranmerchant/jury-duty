import { describe, it, expect } from "vitest";
import { filterTagPickerGuests } from "../lib/tag-picker";

const guests = [
  { user_id: "user-1", balances: { display_name: "Alice Smith", username: "alice" } },
  { user_id: "user-2", balances: { display_name: "Bob Jones", username: "bjones" } },
  { user_id: "user-3", balances: { display_name: null, username: "carol" } },
  { user_id: "user-4", balances: { display_name: "Dan", username: null } },
  { user_id: "user-5", balances: { display_name: null, username: null } },
  { user_id: "me", balances: { display_name: "Me", username: "me" } },
];

describe("filterTagPickerGuests", () => {
  it("excludes the current user regardless of query", () => {
    const result = filterTagPickerGuests(guests, "me", "");
    expect(result.map((g) => g.user_id)).not.toContain("me");
  });

  it("returns all non-self guests when query is empty", () => {
    const result = filterTagPickerGuests(guests, "me", "");
    expect(result).toHaveLength(5);
  });

  it("matches display_name case-insensitively", () => {
    const result = filterTagPickerGuests(guests, "me", "alice");
    expect(result.map((g) => g.user_id)).toContain("user-1");
    expect(result.map((g) => g.user_id)).not.toContain("user-2");
  });

  it("matches username case-insensitively", () => {
    const result = filterTagPickerGuests(guests, "me", "BJONES");
    expect(result.map((g) => g.user_id)).toContain("user-2");
  });

  it("matches display_name when username is null", () => {
    const result = filterTagPickerGuests(guests, "me", "dan");
    expect(result.map((g) => g.user_id)).toContain("user-4");
  });

  it("matches username when display_name is null", () => {
    const result = filterTagPickerGuests(guests, "me", "carol");
    expect(result.map((g) => g.user_id)).toContain("user-3");
  });

  it("always shows guests with no display_name and no username (anonymous)", () => {
    const result = filterTagPickerGuests(guests, "me", "xyz");
    expect(result.map((g) => g.user_id)).toContain("user-5");
  });

  it("returns empty array when no guests match and no anonymous guests", () => {
    const specific = [
      { user_id: "a", balances: { display_name: "Alice", username: "alice" } },
      { user_id: "b", balances: { display_name: "Bob", username: "bob" } },
    ];
    const result = filterTagPickerGuests(specific, "me", "xyz");
    expect(result).toHaveLength(0);
  });

  it("substring match: 'ali' matches Alice", () => {
    const result = filterTagPickerGuests(guests, "me", "ali");
    expect(result.map((g) => g.user_id)).toContain("user-1");
  });
});
