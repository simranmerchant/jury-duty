/** Shared username validation rule — used by route and tests. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$|^[a-z0-9]{3}$/;

export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().trim();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}
