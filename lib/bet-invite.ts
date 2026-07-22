export function buildBetInviteUrl(inviteToken: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/join/bet/${inviteToken}`;
}

export function validateBetJoinBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return "invite_token required";
  const { invite_token } = body as Record<string, unknown>;
  if (!invite_token || typeof invite_token !== "string" || !invite_token.trim()) {
    return "invite_token required";
  }
  return null;
}

// Feed bets (audience = "followers") are the only bets that support invite links.
export function isFeedBetAudience(audience: unknown): boolean {
  return audience === "followers";
}
