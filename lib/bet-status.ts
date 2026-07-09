export type BetPhase = "open" | "closed" | "resolved";

export function betPhase(
  status: "open" | "resolved",
  deadline: string | Date
): BetPhase {
  if (status === "resolved") return "resolved";
  return new Date(deadline) > new Date() ? "open" : "closed";
}

export function canPlaceBet(phase: BetPhase, hasEntry: boolean): boolean {
  return phase === "open" && !hasEntry;
}

// Creator or event host can edit/delete a bet.
export function canEditBet(opts: {
  isCreator: boolean;
  isHost: boolean;
  status: string;
}): boolean {
  return (opts.isCreator || opts.isHost) && opts.status === "open";
}

export function canDeleteBet(opts: {
  isCreator: boolean;
  isHost: boolean;
}): boolean {
  return opts.isCreator || opts.isHost;
}

// Mirrors the authorization check in resolve_bet SQL function.
// resolverIsMember is only relevant for event bets (eventId !== null).
export function canResolve(opts: {
  resolverIsCreator: boolean;
  eventId: string | null;
  deadline: string | Date;
  resolverIsMember: boolean;
}): boolean {
  const { resolverIsCreator, eventId, deadline, resolverIsMember } = opts;
  if (resolverIsCreator) return true;
  if (eventId === null) return false;
  const cutoff = new Date(new Date(deadline).getTime() + 24 * 60 * 60 * 1000);
  if (new Date() < cutoff) return false;
  return resolverIsMember;
}
