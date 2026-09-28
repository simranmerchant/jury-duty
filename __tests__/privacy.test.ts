import { describe, it, expect } from "vitest";
import {
  redactAnonymousEntries,
  redactAnonymousBet,
  canAccessBet,
  buildStakeNotificationBody,
  type EntryLike,
  type BetLike,
} from "../lib/privacy";

const CREATOR = "user-creator";
const STAKER_A = "user-staker-a";
const STAKER_B = "user-staker-b";
const OUTSIDER = "user-outsider";

const makeEntry = (overrides: Partial<EntryLike> = {}): EntryLike => ({
  user_id: STAKER_A,
  option_id: "opt-1",
  points_staked: 50,
  is_anonymous: false,
  balances: { display_name: "Staker A", avatar_url: "https://example.com/a.jpg", username: "stakera" },
  ...overrides,
});

const makeBet = (overrides: Partial<BetLike> = {}): BetLike => ({
  creator_id: CREATOR,
  is_anonymous: false,
  balances: { display_name: "Creator", avatar_url: "https://example.com/c.jpg", username: "creator" },
  ...overrides,
});

// ─── redactAnonymousEntries ──────────────────────────────────────────────────

describe("redactAnonymousEntries — non-anonymous entries", () => {
  it("preserves all fields when is_anonymous is false", () => {
    const entry = makeEntry({ is_anonymous: false });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.user_id).toBe(STAKER_A);
    expect(result.balances?.display_name).toBe("Staker A");
  });

  it("preserves all fields when is_anonymous is null", () => {
    const entry = makeEntry({ is_anonymous: null });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.user_id).toBe(STAKER_A);
    expect(result.balances).not.toBeNull();
  });

  it("preserves all fields when is_anonymous is undefined", () => {
    const entry = makeEntry({ is_anonymous: undefined });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.user_id).toBe(STAKER_A);
    expect(result.balances).not.toBeNull();
  });
});

describe("redactAnonymousEntries — anonymous entry, third-party viewer", () => {
  it("hides user_id from outsider", () => {
    const entry = makeEntry({ is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.user_id).toBeNull();
  });

  it("hides balances from outsider", () => {
    const entry = makeEntry({ is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.balances).toBeNull();
  });

  it("hides user_id from the bet creator viewing their own bet", () => {
    const entry = makeEntry({ is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], CREATOR);
    expect(result.user_id).toBeNull();
  });

  it("hides balances from the bet creator", () => {
    const entry = makeEntry({ is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], CREATOR);
    expect(result.balances).toBeNull();
  });

  it("hides user_id when viewer is null (unauthenticated)", () => {
    const entry = makeEntry({ is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], null);
    expect(result.user_id).toBeNull();
    expect(result.balances).toBeNull();
  });

  it("preserves is_anonymous flag so UI can show 'anonymous'", () => {
    const entry = makeEntry({ is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.is_anonymous).toBe(true);
  });

  it("preserves option_id and points_staked (aggregate stats stay visible)", () => {
    const entry = makeEntry({ is_anonymous: true, points_staked: 200 });
    const [result] = redactAnonymousEntries([entry], OUTSIDER);
    expect(result.option_id).toBe("opt-1");
    expect(result.points_staked).toBe(200);
  });
});

describe("redactAnonymousEntries — anonymous entry, the staker themselves", () => {
  it("preserves user_id for the staker", () => {
    const entry = makeEntry({ user_id: STAKER_A, is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], STAKER_A);
    expect(result.user_id).toBe(STAKER_A);
  });

  it("preserves balances for the staker", () => {
    const entry = makeEntry({ user_id: STAKER_A, is_anonymous: true });
    const [result] = redactAnonymousEntries([entry], STAKER_A);
    expect(result.balances?.display_name).toBe("Staker A");
  });
});

describe("redactAnonymousEntries — mixed list", () => {
  it("only redacts the anonymous entry; non-anonymous entries are untouched", () => {
    const entries: EntryLike[] = [
      makeEntry({ user_id: STAKER_A, is_anonymous: false }),
      makeEntry({ user_id: STAKER_B, is_anonymous: true, balances: { display_name: "Staker B", avatar_url: null, username: "stakerb" } }),
    ];
    const result = redactAnonymousEntries(entries, OUTSIDER);
    expect(result[0].user_id).toBe(STAKER_A);
    expect(result[0].balances?.display_name).toBe("Staker A");
    expect(result[1].user_id).toBeNull();
    expect(result[1].balances).toBeNull();
  });

  it("each staker sees their own anonymous entry unredacted, others redacted", () => {
    const entries: EntryLike[] = [
      makeEntry({ user_id: STAKER_A, is_anonymous: true }),
      makeEntry({ user_id: STAKER_B, is_anonymous: true, balances: { display_name: "Staker B", avatar_url: null, username: "stakerb" } }),
    ];
    const asStakerA = redactAnonymousEntries(entries, STAKER_A);
    expect(asStakerA[0].user_id).toBe(STAKER_A);
    expect(asStakerA[1].user_id).toBeNull();

    const asStakerB = redactAnonymousEntries(entries, STAKER_B);
    expect(asStakerB[0].user_id).toBeNull();
    expect(asStakerB[1].user_id).toBe(STAKER_B);
  });
});

// ─── redactAnonymousBet ──────────────────────────────────────────────────────

describe("redactAnonymousBet — non-anonymous bets", () => {
  it("preserves creator balances when is_anonymous is false", () => {
    const bet = makeBet({ is_anonymous: false });
    const result = redactAnonymousBet(bet, OUTSIDER);
    expect(result.balances?.display_name).toBe("Creator");
  });

  it("preserves creator balances when is_anonymous is null", () => {
    const bet = makeBet({ is_anonymous: null });
    const result = redactAnonymousBet(bet, OUTSIDER);
    expect(result.balances).not.toBeNull();
  });
});

describe("redactAnonymousBet — anonymous bet, non-creator viewer", () => {
  it("hides creator balances from outsider", () => {
    const bet = makeBet({ is_anonymous: true });
    const result = redactAnonymousBet(bet, OUTSIDER);
    expect(result.balances).toBeNull();
  });

  it("hides creator balances from staker", () => {
    const bet = makeBet({ is_anonymous: true });
    const result = redactAnonymousBet(bet, STAKER_A);
    expect(result.balances).toBeNull();
  });

  it("hides creator balances from null viewer", () => {
    const bet = makeBet({ is_anonymous: true });
    const result = redactAnonymousBet(bet, null);
    expect(result.balances).toBeNull();
  });

  it("preserves creator_id (needed for ownership checks)", () => {
    const bet = makeBet({ is_anonymous: true });
    const result = redactAnonymousBet(bet, OUTSIDER);
    expect(result.creator_id).toBe(CREATOR);
  });

  it("preserves is_anonymous flag", () => {
    const bet = makeBet({ is_anonymous: true });
    const result = redactAnonymousBet(bet, OUTSIDER);
    expect(result.is_anonymous).toBe(true);
  });
});

describe("redactAnonymousBet — creator viewing their own anonymous bet", () => {
  it("preserves balances for the creator", () => {
    const bet = makeBet({ is_anonymous: true });
    const result = redactAnonymousBet(bet, CREATOR);
    expect(result.balances?.display_name).toBe("Creator");
  });
});

// ─── canAccessBet ────────────────────────────────────────────────────────────

describe("canAccessBet — creator always has access", () => {
  it("select_people: creator can access their own bet", () => {
    expect(canAccessBet({ audience: "select_people", creatorId: CREATOR, viewerId: CREATOR, isInvited: false, isFollowing: false })).toBe(true);
  });

  it("followers: creator can access their own bet", () => {
    expect(canAccessBet({ audience: "followers", creatorId: CREATOR, viewerId: CREATOR, isInvited: false, isFollowing: false })).toBe(true);
  });
});

describe("canAccessBet — select_people bets", () => {
  it("invited user can access", () => {
    expect(canAccessBet({ audience: "select_people", creatorId: CREATOR, viewerId: OUTSIDER, isInvited: true, isFollowing: false })).toBe(true);
  });

  it("non-invited follower cannot access", () => {
    expect(canAccessBet({ audience: "select_people", creatorId: CREATOR, viewerId: OUTSIDER, isInvited: false, isFollowing: true })).toBe(false);
  });

  it("non-invited non-follower cannot access", () => {
    expect(canAccessBet({ audience: "select_people", creatorId: CREATOR, viewerId: OUTSIDER, isInvited: false, isFollowing: false })).toBe(false);
  });
});

describe("canAccessBet — followers bets", () => {
  it("follower can access", () => {
    expect(canAccessBet({ audience: "followers", creatorId: CREATOR, viewerId: OUTSIDER, isInvited: false, isFollowing: true })).toBe(true);
  });

  it("invited non-follower can access via invite link", () => {
    expect(canAccessBet({ audience: "followers", creatorId: CREATOR, viewerId: OUTSIDER, isInvited: true, isFollowing: false })).toBe(true);
  });

  it("non-follower non-invited cannot access", () => {
    expect(canAccessBet({ audience: "followers", creatorId: CREATOR, viewerId: OUTSIDER, isInvited: false, isFollowing: false })).toBe(false);
  });
});

// ─── buildStakeNotificationBody ─────────────────────────────────────────────

describe("buildStakeNotificationBody — named stake", () => {
  it("includes staker name when not anonymous", () => {
    const body = buildStakeNotificationBody("Alice", 100, "will it rain?", false);
    expect(body).toContain("Alice");
    expect(body).toContain("100");
    expect(body).toContain("will it rain?");
  });

  it("does not include 'anonymous' language when not anonymous", () => {
    const body = buildStakeNotificationBody("Alice", 100, "will it rain?", false);
    expect(body.toLowerCase()).not.toContain("anonymous");
  });
});

describe("buildStakeNotificationBody — anonymous stake", () => {
  it("does not include staker name when anonymous", () => {
    const body = buildStakeNotificationBody("Alice", 100, "will it rain?", true);
    expect(body).not.toContain("Alice");
  });

  it("says 'someone anonymously staked'", () => {
    const body = buildStakeNotificationBody("Alice", 100, "will it rain?", true);
    expect(body).toContain("someone");
    expect(body.toLowerCase()).toContain("anonymous");
  });

  it("still includes points and question (aggregate stats ok)", () => {
    const body = buildStakeNotificationBody("Alice", 75, "who wins tonight?", true);
    expect(body).toContain("75");
    expect(body).toContain("who wins tonight?");
  });
});
