/**
 * Pure functions that determine who receives notifications when a bet is created.
 * Extracted here so they can be unit-tested independently of Supabase/Next.js.
 */

export interface RecipientContext {
  creatorId: string;
  visibility: "public" | "private";
  /** All event/group members except the creator */
  guestIds: string[];
  /** User IDs explicitly included in the private bet invite list (before tagged users are added) */
  explicitInviteIds: string[];
  /** User IDs tagged as options (auto-added to invites on private bets) */
  optionTaggedIds: string[];
  /** User IDs @mentioned in the question text */
  questionTaggedIds: string[];
}

/**
 * Builds the full invite list for a private bet.
 * Only includes creator + explicit invites. Tagged users are never auto-added.
 */
export function buildInviteIds(ctx: RecipientContext): string[] {
  if (ctx.visibility !== "private") return [];
  return [
    ...new Set([
      ctx.creatorId,
      ...ctx.explicitInviteIds,
    ]),
  ];
}

/**
 * Users who should receive a "you were mentioned in the question" notification.
 * Rules:
 * - Not the creator
 * - Not already an option-tagged user (they get a different notification)
 * - Must be a member of the event/group
 * - For private bets: must be in the invite list
 */
export function questionMentionRecipients(
  ctx: RecipientContext,
  inviteIds: string[]
): string[] {
  const guestSet = new Set(ctx.guestIds);
  const optionSet = new Set(ctx.optionTaggedIds);

  return ctx.questionTaggedIds.filter(
    (uid) =>
      uid !== ctx.creatorId &&
      !optionSet.has(uid) &&
      guestSet.has(uid) &&
      (ctx.visibility !== "private" || inviteIds.includes(uid))
  );
}

/**
 * Users who should receive a "you were named as an option" notification.
 * Rules:
 * - Not the creator
 * - Must be a member of the event/group
 * - For private bets: must also be in the invite list
 */
export function optionTagRecipients(ctx: RecipientContext, inviteIds?: string[]): string[] {
  const guestSet = new Set(ctx.guestIds);
  const inviteSet = new Set(inviteIds ?? []);
  return ctx.optionTaggedIds.filter(
    (uid) =>
      uid !== ctx.creatorId &&
      guestSet.has(uid) &&
      (ctx.visibility !== "private" || inviteSet.has(uid))
  );
}
