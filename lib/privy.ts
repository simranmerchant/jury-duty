import { PrivyClient } from "@privy-io/server-auth";

export const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// Per-process cache: avoids re-verifying the same JWT on every request
// within the same warm Vercel function instance. TTL is 55s (Privy tokens
// rotate every 60s, so we always re-verify near expiry).
type CachedUser = { user: Awaited<ReturnType<typeof privy.verifyAuthToken>>; expiresAt: number };
const tokenCache = new Map<string, CachedUser>();
const CACHE_TTL_MS = 55_000;

// Call this at the top of every server action / route handler that mutates data.
// Returns the verified user or throws — never returns null.
export async function requireUser(accessToken: string) {
  const now = Date.now();
  const hit = tokenCache.get(accessToken);
  if (hit && hit.expiresAt > now) return hit.user;

  // Evict stale entries to keep the map bounded
  if (tokenCache.size > 500) {
    for (const [k, v] of tokenCache) {
      if (v.expiresAt <= now) tokenCache.delete(k);
    }
  }

  try {
    const user = await privy.verifyAuthToken(accessToken);
    tokenCache.set(accessToken, { user, expiresAt: now + CACHE_TTL_MS });
    return user;
  } catch (e: any) {
    console.error("[requireUser] verifyAuthToken failed:", e?.message ?? String(e));
    throw e;
  }
}
