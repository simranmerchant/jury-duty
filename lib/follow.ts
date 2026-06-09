export function computeFollowStatus(isPrivate: boolean): "pending" | "accepted" {
  return isPrivate ? "pending" : "accepted";
}

export function buildFollowNotification(
  followerName: string,
  status: "pending" | "accepted"
): { type: string; title: string; body: string } {
  if (status === "pending") {
    return {
      type: "follow_request",
      title: "new follow request",
      body: `${followerName} wants to follow you.`,
    };
  }
  return {
    type: "new_follower",
    title: "new follower",
    body: `${followerName} started following you.`,
  };
}

export function buildAcceptNotification(accepterName: string): { type: string; title: string; body: string } {
  return {
    type: "follow_accepted",
    title: "follow request accepted",
    body: `${accepterName} accepted your follow request.`,
  };
}
