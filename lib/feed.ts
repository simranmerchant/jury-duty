export type FeedBetInput = {
  question: unknown;
  options: unknown;
  deadline: unknown;
};

export type FeedBetValidationError =
  | "question required (max 200 chars)"
  | "at least 2 options required"
  | "each option must be 1-100 chars"
  | "deadline required"
  | "deadline must be in the future";

export function validateFeedBet(
  input: FeedBetInput,
  nowMs = Date.now()
): FeedBetValidationError | null {
  const { question, options, deadline } = input;

  if (typeof question !== "string" || !question.trim() || question.trim().length > 200) {
    return "question required (max 200 chars)";
  }

  if (!Array.isArray(options) || options.length < 2) {
    return "at least 2 options required";
  }

  const labels: string[] = options.map((o: any) =>
    typeof o === "string" ? o : o?.label ?? ""
  );
  if (labels.some((l) => !l.trim() || l.trim().length > 100)) {
    return "each option must be 1-100 chars";
  }

  if (!deadline) return "deadline required";

  const deadlineMs = new Date(deadline as string).getTime();
  if (isNaN(deadlineMs) || deadlineMs <= nowMs) {
    return "deadline must be in the future";
  }

  return null;
}

export function buildFeedBetNotification(
  creatorName: string,
  question: string
): { type: string; title: string; body: string } {
  return {
    type: "new_feed_bet",
    title: `${creatorName} posted a new prediction 🗳️`,
    body: question.trim(),
  };
}

// ── Feed capabilities ─────────────────────────────────────────────────────────

export function parseFeedCapabilities(header: string): {
  supportsPollPost: boolean;
  supportsExploreBetPost: boolean;
} {
  return {
    supportsPollPost: header.includes("poll-post"),
    supportsExploreBetPost: header.includes("explore-bet-post"),
  };
}

// ── Reaction aggregation ──────────────────────────────────────────────────────

export function aggregateBetReactions(
  reactions: Array<{ user_id: string; emoji: string }>,
  userId: string
): { reactions: Array<{ emoji: string; count: number }>; myReaction: string | null } {
  const counts: Record<string, number> = {};
  for (const r of reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  return {
    reactions: Object.entries(counts).map(([emoji, count]) => ({ emoji, count })),
    myReaction: reactions.find((r) => r.user_id === userId)?.emoji ?? null,
  };
}

// ── Feed item merge / sort / slice ────────────────────────────────────────────

export function mergeFeedItems<T extends { created_at: string }>(
  arrays: T[][],
  limit = 20
): T[] {
  return arrays
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
