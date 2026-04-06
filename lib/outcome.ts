export type Outcome = "pending" | "won" | "lost" | "refunded";

export function computeOutcome(
  status: string,
  winning_option_id: string | null,
  option_id: string
): Outcome {
  if (status !== "resolved") return "pending";
  if (winning_option_id === null) return "refunded";
  return winning_option_id === option_id ? "won" : "lost";
}
