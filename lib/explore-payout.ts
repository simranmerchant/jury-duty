export type ExploreEntry = { user_id: string; side: "a" | "b"; points_wagered: number };

// Compute payouts for an explore bet resolution.
// winning_side=null means void — everyone is refunded.
// Winners receive proportional share of the total pot based on their stake.
export function computeExplorePayout(
  entries: ExploreEntry[],
  winning_side: "a" | "b" | null
): Record<string, number> {
  const payouts: Record<string, number> = {};

  if (winning_side === null) {
    for (const e of entries) {
      payouts[e.user_id] = (payouts[e.user_id] ?? 0) + e.points_wagered;
    }
    return payouts;
  }

  const winners = entries.filter((e) => e.side === winning_side);

  if (winners.length === 0) {
    // Nobody picked the winning side — refund all
    for (const e of entries) {
      payouts[e.user_id] = (payouts[e.user_id] ?? 0) + e.points_wagered;
    }
    return payouts;
  }

  const totalPot = entries.reduce((s, e) => s + e.points_wagered, 0);
  const winnerTotal = winners.reduce((s, e) => s + e.points_wagered, 0);

  // Proportional share: floor for all but last winner, who absorbs remainder
  let distributed = 0;
  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    const share =
      i < winners.length - 1
        ? Math.floor((w.points_wagered / winnerTotal) * totalPot)
        : totalPot - distributed;
    payouts[w.user_id] = (payouts[w.user_id] ?? 0) + share;
    distributed += share;
  }

  return payouts;
}
