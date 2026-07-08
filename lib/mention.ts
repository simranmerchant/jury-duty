/**
 * Pure logic for @mention detection, insertion, and extraction.
 * Extracted here so it can be unit-tested independently of React / Next.js.
 */

/**
 * Extracts all @mentioned usernames from a text string.
 * Returns the raw username portion (no @ prefix) in the order they appear.
 * Duplicates are preserved — callers can deduplicate if needed.
 */
export function extractMentions(text: string): string[] {
  return [...text.matchAll(/@(\w+)/g)].map((m) => m[1]);
}

export interface MentionState {
  /** Non-null when a mention is being typed; the partial word after @ */
  search: string | null;
  /** Lowercase version of search for filtering */
  filter: string;
}

/**
 * Given the current text value and cursor position, detect whether the user
 * is in the middle of typing an @mention.
 *
 * Rules:
 * - Find the last @ before the cursor
 * - The word between @ and the cursor must not contain a space (still typing)
 * - Returns { search, filter } when active, { search: null, filter: "" } otherwise
 */
export function detectMention(value: string, cursor: number): MentionState {
  const textUpToCursor = value.slice(0, cursor);
  const atIndex = textUpToCursor.lastIndexOf("@");

  if (atIndex !== -1) {
    const wordAfterAt = textUpToCursor.slice(atIndex + 1);
    if (!wordAfterAt.includes(" ")) {
      return { search: wordAfterAt, filter: wordAfterAt.toLowerCase() };
    }
  }

  return { search: null, filter: "" };
}

/**
 * Inserts a display name at the position of the last @ before the cursor.
 * Returns the new question string and the new cursor position.
 */
export function insertMention(
  question: string,
  cursor: number,
  displayName: string
): { newQuestion: string; newCursor: number } {
  const textUpToCursor = question.slice(0, cursor);
  const atIndex = textUpToCursor.lastIndexOf("@");
  const before = question.slice(0, atIndex);
  const after = question.slice(cursor);
  const newQuestion = `${before}@${displayName}${after}`;
  const newCursor = before.length + displayName.length + 1; // +1 for @
  return { newQuestion, newCursor };
}
