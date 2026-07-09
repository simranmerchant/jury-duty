export type BetForEvent = {
  status: string;
  creator_id: string;
  created_at: string;
  deadline: string;
  bet_entries: { user_id: string }[];
};

// Returns true if the user has at least one open bet they haven't voted on yet.
// Own bets (creator_id === userId) are excluded — you can't vote on your own bet.
export function hasUnvotedOpen(
  bets: BetForEvent[],
  userId: string,
  now = new Date()
): boolean {
  return bets.some(
    (b) =>
      b.status === "open" &&
      new Date(b.deadline) > now &&
      b.creator_id !== userId &&
      !b.bet_entries.some((e) => e.user_id === userId)
  );
}

// Returns true if any bet was posted by someone other than userId after seenAt.
export function hasNewBets(
  bets: BetForEvent[],
  userId: string,
  seenAt: string | undefined
): boolean {
  return bets.some(
    (b) =>
      b.creator_id !== userId &&
      (!seenAt || new Date(b.created_at) > new Date(seenAt))
  );
}
