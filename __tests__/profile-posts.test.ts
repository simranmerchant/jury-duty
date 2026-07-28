import { describe, it, expect } from "vitest";
import { shapeProfilePosts, type RawBetPost, type RawExploreBetPost, type RawPollPost } from "../lib/profile-posts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function betPost(overrides: Partial<RawBetPost> = {}): RawBetPost {
  return {
    id: "bet-post-1",
    photo_url: null,
    created_at: "2025-07-20T10:00:00.000Z",
    bets: { question: "will it rain?" },
    post_likes: [],
    post_comments: [],
    ...overrides,
  };
}

function explorePost(overrides: Partial<RawExploreBetPost> = {}): RawExploreBetPost {
  return {
    id: "ebp-row-1",
    explore_bet_id: "explore-bet-1",
    photo_url: null,
    created_at: "2025-07-20T11:00:00.000Z",
    explore_bets: {
      question: "world cup final score?",
      explore_bet_likes: [],
      explore_bet_comments: [],
    },
    ...overrides,
  };
}

function pollPost(overrides: Partial<RawPollPost> = {}): RawPollPost {
  return {
    poll_id: "poll-1",
    photo_url: null,
    created_at: "2025-07-20T09:00:00.000Z",
    polls: { question: "cats or dogs?" },
    poll_likes: [],
    poll_comments: [],
    ...overrides,
  };
}

// ─── type mapping ─────────────────────────────────────────────────────────────

describe("shapeProfilePosts — type mapping", () => {
  it("maps bet posts to type 'post'", () => {
    const [p] = shapeProfilePosts([betPost()], null, null);
    expect(p.type).toBe("post");
  });

  it("maps explore bet posts to type 'explore_bet_post'", () => {
    const [p] = shapeProfilePosts(null, [explorePost()], null);
    expect(p.type).toBe("explore_bet_post");
  });

  it("maps poll posts to type 'poll_post'", () => {
    const [p] = shapeProfilePosts(null, null, [pollPost()]);
    expect(p.type).toBe("poll_post");
  });
});

// ─── id extraction ────────────────────────────────────────────────────────────

describe("shapeProfilePosts — id extraction", () => {
  it("uses post.id for bet posts", () => {
    const [p] = shapeProfilePosts([betPost({ id: "my-post-id" })], null, null);
    expect(p.id).toBe("my-post-id");
  });

  it("uses explore_bet_id (not row id) for explore posts", () => {
    const [p] = shapeProfilePosts(null, [explorePost({ id: "row-id", explore_bet_id: "actual-bet-id" })], null);
    expect(p.id).toBe("actual-bet-id");
  });

  it("uses poll_id for poll posts", () => {
    const [p] = shapeProfilePosts(null, null, [pollPost({ poll_id: "my-poll" })]);
    expect(p.id).toBe("my-poll");
  });
});

// ─── question extraction ──────────────────────────────────────────────────────

describe("shapeProfilePosts — bet_question", () => {
  it("extracts question from bets join for bet posts", () => {
    const [p] = shapeProfilePosts([betPost({ bets: { question: "will it snow?" } })], null, null);
    expect(p.bet_question).toBe("will it snow?");
  });

  it("returns null bet_question when bets join is null", () => {
    const [p] = shapeProfilePosts([betPost({ bets: null })], null, null);
    expect(p.bet_question).toBeNull();
  });

  it("extracts question from explore_bets join for explore posts", () => {
    const ep = explorePost({
      explore_bets: { question: "world cup winner?", explore_bet_likes: [], explore_bet_comments: [] },
    });
    const [p] = shapeProfilePosts(null, [ep], null);
    expect(p.bet_question).toBe("world cup winner?");
  });

  it("returns null bet_question when explore_bets join is null", () => {
    const [p] = shapeProfilePosts(null, [explorePost({ explore_bets: null })], null);
    expect(p.bet_question).toBeNull();
  });

  it("extracts question from polls join for poll posts", () => {
    const [p] = shapeProfilePosts(null, null, [pollPost({ polls: { question: "cats or dogs?" } })]);
    expect(p.bet_question).toBe("cats or dogs?");
  });

  it("returns null bet_question when polls join is null", () => {
    const [p] = shapeProfilePosts(null, null, [pollPost({ polls: null })]);
    expect(p.bet_question).toBeNull();
  });
});

// ─── like / comment counts ────────────────────────────────────────────────────

describe("shapeProfilePosts — like_count and comment_count", () => {
  it("counts post_likes and post_comments for bet posts", () => {
    const p = betPost({
      post_likes: [{ user_id: "a" }, { user_id: "b" }],
      post_comments: [{ id: "c1" }],
    });
    const [shaped] = shapeProfilePosts([p], null, null);
    expect(shaped.like_count).toBe(2);
    expect(shaped.comment_count).toBe(1);
  });

  it("counts explore_bet_likes and explore_bet_comments from nested join", () => {
    const ep = explorePost({
      explore_bets: {
        question: "q",
        explore_bet_likes: [{ user_id: "x" }, { user_id: "y" }, { user_id: "z" }],
        explore_bet_comments: [{ id: "c1" }, { id: "c2" }],
      },
    });
    const [shaped] = shapeProfilePosts(null, [ep], null);
    expect(shaped.like_count).toBe(3);
    expect(shaped.comment_count).toBe(2);
  });

  it("returns 0 likes/comments when explore_bets join is null", () => {
    const [shaped] = shapeProfilePosts(null, [explorePost({ explore_bets: null })], null);
    expect(shaped.like_count).toBe(0);
    expect(shaped.comment_count).toBe(0);
  });

  it("counts poll_likes and poll_comments for poll posts", () => {
    const pp = pollPost({
      poll_likes: [{ user_id: "a" }],
      poll_comments: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
    });
    const [shaped] = shapeProfilePosts(null, null, [pp]);
    expect(shaped.like_count).toBe(1);
    expect(shaped.comment_count).toBe(3);
  });
});

// ─── photo_url ────────────────────────────────────────────────────────────────

describe("shapeProfilePosts — photo_url", () => {
  it("passes through a non-null photo_url", () => {
    const [p] = shapeProfilePosts([betPost({ photo_url: "https://cdn.example.com/img.jpg" })], null, null);
    expect(p.photo_url).toBe("https://cdn.example.com/img.jpg");
  });

  it("returns null when photo_url is null", () => {
    const [p] = shapeProfilePosts([betPost({ photo_url: null })], null, null);
    expect(p.photo_url).toBeNull();
  });
});

// ─── sort order ───────────────────────────────────────────────────────────────

describe("shapeProfilePosts — sort order (newest first)", () => {
  it("sorts mixed types by created_at descending", () => {
    const bp = betPost({ id: "bp", created_at: "2025-07-20T10:00:00.000Z" });
    const ep = explorePost({ explore_bet_id: "ep", created_at: "2025-07-20T12:00:00.000Z" });
    const pp = pollPost({ poll_id: "pp", created_at: "2025-07-20T11:00:00.000Z" });
    const result = shapeProfilePosts([bp], [ep], [pp]);
    expect(result.map((r) => r.id)).toEqual(["ep", "pp", "bp"]);
  });

  it("handles all three types with equal timestamps (stable — no crash)", () => {
    const ts = "2025-07-20T10:00:00.000Z";
    const result = shapeProfilePosts(
      [betPost({ id: "bp", created_at: ts })],
      [explorePost({ explore_bet_id: "ep", created_at: ts })],
      [pollPost({ poll_id: "pp", created_at: ts })]
    );
    expect(result).toHaveLength(3);
  });

  it("returns empty array when all inputs are null", () => {
    expect(shapeProfilePosts(null, null, null)).toEqual([]);
  });

  it("returns empty array when all inputs are empty arrays", () => {
    expect(shapeProfilePosts([], [], [])).toEqual([]);
  });
});

// ─── limit ───────────────────────────────────────────────────────────────────

describe("shapeProfilePosts — limit", () => {
  it("defaults to 60 items", () => {
    const posts = Array.from({ length: 80 }, (_, i) =>
      betPost({ id: `bp-${i}`, created_at: new Date(2025, 0, 1, 0, 0, i).toISOString() })
    );
    expect(shapeProfilePosts(posts, null, null)).toHaveLength(60);
  });

  it("respects a custom limit", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      betPost({ id: `bp-${i}`, created_at: new Date(2025, 0, 1, 0, 0, i).toISOString() })
    );
    expect(shapeProfilePosts(posts, null, null, 5)).toHaveLength(5);
  });

  it("returns fewer than limit when total items are under the cap", () => {
    expect(shapeProfilePosts([betPost()], [explorePost()], null)).toHaveLength(2);
  });
});
