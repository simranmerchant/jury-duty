export type TopicInput = { name: unknown; emoji?: unknown; description?: unknown };
export type TopicValidationError = "name required" | "name max 60 chars";

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
