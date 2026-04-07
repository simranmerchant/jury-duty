/**
 * Normalizes a user-supplied search query:
 * - Strips leading @ so "@jake" works the same as "jake"
 * - Removes PostgREST filter-string special chars to prevent condition injection
 *   (comma splits conditions; parens/quotes/dots can alter filter syntax)
 */
export function sanitizeSearchQuery(raw: string): string {
  const stripped = raw.startsWith("@") ? raw.slice(1) : raw;
  return stripped.replace(/[,.()"]/g, "");
}
