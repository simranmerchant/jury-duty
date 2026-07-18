/** Returns true when a post with the given targeted_user_ids is visible to viewerId. */
export function isPostVisibleToUser(
  targetedUserIds: string[] | null | undefined,
  viewerId: string
): boolean {
  if (!targetedUserIds || targetedUserIds.length === 0) return true;
  return targetedUserIds.includes(viewerId);
}

/** Validates the body of a share request (bet or poll post). */
export function validateShareBody(body: {
  caption?: unknown;
  photo_url?: unknown;
  targeted_user_ids?: unknown;
}): string | null {
  const { caption, photo_url, targeted_user_ids } = body;
  if (caption !== undefined && caption !== null) {
    if (typeof caption !== "string") return "caption must be a string";
    if (caption.length > 280) return "caption too long";
  }
  if (photo_url !== undefined && photo_url !== null && typeof photo_url !== "string") {
    return "invalid photo_url";
  }
  if (targeted_user_ids !== undefined && !Array.isArray(targeted_user_ids)) {
    return "targeted_user_ids must be an array";
  }
  if (Array.isArray(targeted_user_ids)) {
    for (const id of targeted_user_ids) {
      if (typeof id !== "string" || !id.trim()) return "targeted_user_ids must contain non-empty strings";
    }
  }
  return null;
}
