/**
 * Pure logic for building resolve-bet notifications.
 * Extracted so it can be unit-tested independently of Supabase/Next.js.
 */

export type ResolveNotificationType =
  | "bet_resolved_won"
  | "bet_resolved_lost"
  | "bet_resolved_refunded";

export interface BetEntry {
  user_id: string;
  option_id: string;
}

export interface ResolveNotification {
  user_id: string;
  type: ResolveNotificationType;
  title: string;
  body: string;
  data: { bet_id: string; event_id?: string };
}

/**
 * Builds the in-app notification payloads for every participant when a bet resolves.
 *
 * @param betId           The bet being resolved
 * @param question        The bet question text
 * @param entries         All bet_entries for this bet
 * @param winningOptionId The winning option, or null for a refund
 */
export function buildResolveNotifications(
  betId: string,
  question: string,
  entries: BetEntry[],
  winningOptionId: string | null,
  eventId?: string
): ResolveNotification[] {
  const isRefund = winningOptionId === null;

  return entries.map((entry) => {
    const won = !isRefund && entry.option_id === winningOptionId;
    const type: ResolveNotificationType = isRefund
      ? "bet_resolved_refunded"
      : won
      ? "bet_resolved_won"
      : "bet_resolved_lost";

    const title = isRefund
      ? "case dismissed"
      : won
      ? "jury's in — you won 🎉"
      : "jury's in — you lost 💀";

    const body = isRefund
      ? `"${question}" was called off. your points have been refunded.`
      : won
      ? `you called it on "${question}". points incoming.`
      : `you were wrong about "${question}". the jury has spoken.`;

    return { user_id: entry.user_id, type, title, body, data: { bet_id: betId, ...(eventId ? { event_id: eventId } : {}) } };
  });
}
