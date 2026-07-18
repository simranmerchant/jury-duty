export type PollInput = {
  question: unknown;
  option_a: unknown;
  option_b: unknown;
  closes_at?: unknown;
};

export type PollValidationError =
  | "question required"
  | "question too long"
  | "option_a required"
  | "option_b required"
  | "option_a too long"
  | "option_b too long"
  | "closes_at must be in the future";

export function validatePoll(
  input: PollInput,
  nowMs = Date.now()
): PollValidationError | null {
  const { question, option_a, option_b, closes_at } = input;

  if (typeof question !== "string" || !question.trim()) return "question required";
  if (question.trim().length > 200) return "question too long";

  if (typeof option_a !== "string" || !option_a.trim()) return "option_a required";
  if (option_a.trim().length > 80) return "option_a too long";

  if (typeof option_b !== "string" || !option_b.trim()) return "option_b required";
  if (option_b.trim().length > 80) return "option_b too long";

  if (closes_at !== undefined && closes_at !== null) {
    const closesMs = new Date(closes_at as string).getTime();
    if (isNaN(closesMs) || closesMs <= nowMs) return "closes_at must be in the future";
  }

  return null;
}

export function aggregatePollVotes(votes: Array<{ side: string }>) {
  const votes_a = votes.filter((v) => v.side === "a").length;
  const votes_b = votes.filter((v) => v.side === "b").length;
  return { votes_a, votes_b, total_votes: votes_a + votes_b };
}

export function aggregatePollReactions(reactions: Array<{ emoji: string }>) {
  const counts: Record<string, number> = {};
  for (const r of reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
}
