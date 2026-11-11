import { describe, it, expect } from "vitest";
import { shouldCreatePost } from "../lib/resolve-post";

const feedBet = { event_id: null };
const groupBet = { event_id: "event-123" };

describe("shouldCreatePost — no media or caption", () => {
  it("feed bet: no post without photo/caption", () => {
    expect(shouldCreatePost(feedBet, undefined, undefined, undefined)).toBe(false);
  });

  it("group bet: no post without photo/caption", () => {
    expect(shouldCreatePost(groupBet, undefined, undefined, undefined)).toBe(false);
  });

  it("returns false when bet is null", () => {
    expect(shouldCreatePost(null, "some caption", undefined, undefined)).toBe(false);
  });
});

describe("shouldCreatePost — caption only", () => {
  it("feed bet: creates post with caption", () => {
    expect(shouldCreatePost(feedBet, "great call!", undefined, undefined)).toBe(true);
  });

  it("group bet: creates post with caption", () => {
    expect(shouldCreatePost(groupBet, "called it", undefined, undefined)).toBe(true);
  });

  it("empty string caption does not create post", () => {
    expect(shouldCreatePost(feedBet, "", undefined, undefined)).toBe(false);
  });
});

describe("shouldCreatePost — photo only", () => {
  it("feed bet: creates post with photo_url", () => {
    expect(shouldCreatePost(feedBet, undefined, "https://cdn.example.com/img.jpg", undefined)).toBe(true);
  });

  it("group bet: creates post with photo_url", () => {
    expect(shouldCreatePost(groupBet, undefined, "https://cdn.example.com/img.jpg", undefined)).toBe(true);
  });
});

describe("shouldCreatePost — video only", () => {
  it("feed bet: creates post with video_url", () => {
    expect(shouldCreatePost(feedBet, undefined, undefined, "https://cdn.example.com/vid.mp4")).toBe(true);
  });

  it("group bet: creates post with video_url", () => {
    expect(shouldCreatePost(groupBet, undefined, undefined, "https://cdn.example.com/vid.mp4")).toBe(true);
  });
});

describe("shouldCreatePost — photo + caption", () => {
  it("feed bet: creates post with both", () => {
    expect(shouldCreatePost(feedBet, "nailed it", "https://cdn.example.com/img.jpg", undefined)).toBe(true);
  });

  it("group bet: creates post with both", () => {
    expect(shouldCreatePost(groupBet, "nailed it", "https://cdn.example.com/img.jpg", undefined)).toBe(true);
  });
});
