/**
 * Normalize an array of raw phone strings to E.164 format.
 * Strips formatting, handles 10-digit US numbers by prepending +1,
 * and passes through numbers that already start with +.
 * Invalid/unrecognizable numbers are dropped.
 */
export function normalizePhones(rawPhones: unknown[]): string[] {
  const out = new Set<string>();
  for (const raw of rawPhones) {
    if (typeof raw !== "string") continue;
    const normalized = normalizePhone(raw);
    if (normalized) out.add(normalized);
  }
  return [...out];
}

export function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/\D/g, "");
  if (stripped.length === 10) return `+1${stripped}`;
  if (stripped.length === 11 && stripped.startsWith("1")) return `+${stripped}`;
  // Already had a leading + and 11+ digits (international)
  if (raw.trim().startsWith("+") && stripped.length >= 8) return `+${stripped}`;
  return null;
}
