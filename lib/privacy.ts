// Pure functions for stripping identifying information before sending data to clients.
// These are the single source of truth for what a given viewer is allowed to see.

export type EntryLike = {
  user_id: string | null;
  option_id: string;
  points_staked: number;
  is_anonymous?: boolean | null;
  balances?: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
  [key: string]: unknown;
};

export type BetLike = {
  creator_id: string;
  is_anonymous?: boolean | null;
  balances?: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
  [key: string]: unknown;
};

/**
 * Strips user_id + balances from any entry where is_anonymous=true and the
 * viewer is not the staker themselves. The is_anonymous flag itself is kept so
 * the UI can show "anonymous" instead of a name.
 */
export function redactAnonymousEntries<T extends EntryLike>(
  entries: T[],
  viewerUserId: string | null | undefined
): T[] {
  return entries.map((e) => {
    if (!e.is_anonymous) return e;
    // The staker always sees their own entry unchanged
    if (e.user_id && e.user_id === viewerUserId) return e;
    return { ...e, user_id: null, balances: null };
  });
}

/**
 * Strips creator balances from a bet when the creator chose to post anonymously
 * and the viewer is not the creator.
 */
export function redactAnonymousBet<T extends BetLike>(
  bet: T,
  viewerUserId: string | null | undefined
): T {
  if (!bet.is_anonymous) return bet;
  if (bet.creator_id === viewerUserId) return bet;
  return { ...bet, balances: null };
}

/**
 * Returns true when a viewer is allowed to see a select_people or followers bet.
 * Pure: all DB-derived booleans are passed in, no side effects.
 */
export function canAccessBet({
  audience,
  creatorId,
  viewerId,
  isInvited,
  isFollowing,
}: {
  audience: string;
  creatorId: string;
  viewerId: string;
  isInvited: boolean;
  isFollowing: boolean;
}): boolean {
  if (viewerId === creatorId) return true;
  if (audience === "select_people") return isInvited;
  if (audience === "followers") return isFollowing || isInvited;
  return false;
}

/**
 * Returns the display name to use for a bet creator in outbound notifications.
 * When the bet is anonymous, always returns "someone" regardless of the real name.
 */
export function resolveCreatorName(
  displayName: string | null | undefined,
  isAnonymous: boolean
): string {
  if (isAnonymous) return "someone";
  return displayName ?? "someone";
}

/**
 * Returns the staker notification body, hiding the staker's name when they
 * chose to remain anonymous.
 */
export function buildStakeNotificationBody(
  stakerName: string,
  points: number,
  question: string,
  isAnonymous: boolean
): string {
  if (isAnonymous) return `someone anonymously staked ${points} pts on "${question}"`;
  return `${stakerName} staked ${points} pts on "${question}"`;
}
