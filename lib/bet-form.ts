/**
 * Pure validation logic for the new bet form.
 * Extracted so it can be unit-tested independently of React.
 */

export interface BetOption {
  label: string;
  tagged_user_id?: string;
}

export interface BetFormState {
  question: string;
  options: BetOption[];
  isGroup: boolean;
  deadline: string;
}

/**
 * Returns true when the form is valid and ready to submit.
 *
 * Rules:
 * - Question must be 1–200 chars (trimmed)
 * - At least 2 filled options (filled = non-empty label OR has a tagged user)
 * - Every option that is shown must have a non-empty label (≤100 chars) OR a tagged user
 * - Group bets require a deadline
 */
export function canSubmit({ question, options, isGroup, deadline }: BetFormState): boolean {
  const qTrimmed = question.trim();
  if (qTrimmed.length === 0 || qTrimmed.length > 200) return false;

  const filledOptions = options.filter((o) => o.label.trim() || o.tagged_user_id);
  if (filledOptions.length < 2) return false;

  const allValid = options.every(
    (o) => (o.label.trim() || o.tagged_user_id) && o.label.trim().length <= 100
  );
  if (!allValid) return false;

  if (isGroup && !deadline) return false;

  return true;
}

/**
 * Returns the label to display for an option when tagging a guest.
 * Falls back through display_name → username → "?" to avoid empty labels.
 */
export function tagOptionLabel(
  displayName: string | null | undefined,
  username: string | null | undefined
): string {
  return displayName ?? username ?? "?";
}
