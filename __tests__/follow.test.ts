import { computeFollowStatus, buildFollowNotification, buildAcceptNotification } from "../lib/follow";

describe("computeFollowStatus", () => {
  it("returns accepted for public accounts", () => {
    expect(computeFollowStatus(false)).toBe("accepted");
  });
  it("returns pending for private accounts", () => {
    expect(computeFollowStatus(true)).toBe("pending");
  });
});

describe("buildFollowNotification", () => {
  it("builds follow_request notification for private accounts", () => {
    const n = buildFollowNotification("Alice", "pending");
    expect(n.type).toBe("follow_request");
    expect(n.title).toBe("new follow request");
    expect(n.body).toBe("Alice wants to follow you.");
  });

  it("builds new_follower notification for public accounts", () => {
    const n = buildFollowNotification("Bob", "accepted");
    expect(n.type).toBe("new_follower");
    expect(n.title).toBe("new follower");
    expect(n.body).toBe("Bob started following you.");
  });

  it("includes follower name in body", () => {
    expect(buildFollowNotification("someone", "pending").body).toContain("someone");
    expect(buildFollowNotification("someone", "accepted").body).toContain("someone");
  });
});

describe("buildAcceptNotification", () => {
  it("builds follow_accepted notification", () => {
    const n = buildAcceptNotification("Charlie");
    expect(n.type).toBe("follow_accepted");
    expect(n.title).toBe("follow request accepted");
    expect(n.body).toBe("Charlie accepted your follow request.");
  });

  it("includes accepter name in body", () => {
    expect(buildAcceptNotification("Diana").body).toContain("Diana");
  });
});
