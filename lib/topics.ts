export type TopicInput = { name: unknown; description?: unknown };
export type TopicValidationError = "name required" | "name max 60 chars";

/**
 * Returns true when `userId` may delete or manage the topic.
 * Unclaimed topics (creator_id === null) are manageable by any authenticated user.
 */
export function isTopicEditable(creatorId: string | null, userId: string): boolean {
  return creatorId === null || creatorId === userId;
}

/**
 * Returns true when `userId` is the topic's creator, or when the topic has no
 * recorded creator (legacy topics created before creator tracking was added).
 */
export function isTopicMine(creatorId: string | null, userId: string): boolean {
  return creatorId === null || creatorId === userId;
}

export function validateTopic(input: TopicInput): TopicValidationError | null {
  const { name } = input;
  if (typeof name !== "string" || !name.trim()) return "name required";
  if (name.trim().length > 60) return "name max 60 chars";
  return null;
}

// Aggregates raw explore_bets rows (topic_id column) into a map of
// topic_id → bet count.  Null topic_ids are skipped.
export function buildTopicBetCounts(
  rows: { topic_id: string | null }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (r.topic_id) counts[r.topic_id] = (counts[r.topic_id] ?? 0) + 1;
  }
  return counts;
}
