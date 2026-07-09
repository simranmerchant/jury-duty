export type BetEntry = { userId: string; optionId: string; staked: number };

// Aggregates stakes by user for bet-deletion refunds.
// Uses the snake_case field names that come directly from Supabase rows.
export function calculateRefunds(
  entries: { user_id: string; points_staked: number }[]
): Record<string, number> {
  const refunds: Record<string, number> = {};
  for (const e of entries) {
    refunds[e.user_id] = (refunds[e.user_id] ?? 0) + e.points_staked;
  }
  return refunds;
}

// Mirrors the resolve_bet Postgres function's payout logic.
// Returns a map of userId → points to credit.
// winningOptionId=null means void (refund everyone).
export function computePayouts(
  entries: BetEntry[],
  winningOptionId: string | null
): Record<string, number> {
  const result: Record<string, number> = {};

  if (winningOptionId === null) {
    for (const e of entries) result[e.userId] = (result[e.userId] ?? 0) + e.staked;
    return result;
  }

  const totalPot = entries.reduce((s, e) => s + e.staked, 0);
  const winners = entries.filter((e) => e.optionId === winningOptionId);

  // No entries on the winning side → refund everyone (matches SQL v_winner_count = 0 branch)
  if (winners.length === 0) {
    for (const e of entries) result[e.userId] = (result[e.userId] ?? 0) + e.staked;
    return result;
  }

  const payoutEach = Math.floor(totalPot / winners.length);
  const remainder = totalPot - payoutEach * winners.length;

  for (const w of winners) result[w.userId] = (result[w.userId] ?? 0) + payoutEach;

  // Remainder goes to the first winner (matches SQL order by created_at asc)
  if (remainder > 0) result[winners[0].userId] += remainder;

  return result;
}
