import { supabase } from "@/lib/supabase";
import { privy } from "@/lib/privy";

type AuthUser = { userId: string; provider: "supabase" | "privy" };

type CachedUser = { user: AuthUser; expiresAt: number };
const tokenCache = new Map<string, CachedUser>();
const CACHE_TTL_MS = 55_000;

// Verify a JWT from either Supabase Auth or Privy (legacy).
// Returns { userId } — the caller doesn't need to know which provider.
export async function requireUser(accessToken: string): Promise<AuthUser> {
  const now = Date.now();
  const hit = tokenCache.get(accessToken);
  if (hit && hit.expiresAt > now) return hit.user;

  if (tokenCache.size > 500) {
    for (const [k, v] of tokenCache) {
      if (v.expiresAt <= now) tokenCache.delete(k);
    }
  }

  // Try Supabase Auth first (new app versions)
  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      const user: AuthUser = { userId: data.user.id, provider: "supabase" };
      tokenCache.set(accessToken, { user, expiresAt: now + CACHE_TTL_MS });
      return user;
    }
  } catch {
    // fall through to Privy
  }

  // Fall back to Privy (old app versions still in the wild)
  try {
    const privyUser = await privy.verifyAuthToken(accessToken);
    const user: AuthUser = { userId: privyUser.userId, provider: "privy" };
    tokenCache.set(accessToken, { user, expiresAt: now + CACHE_TTL_MS });
    return user;
  } catch (e: any) {
    console.error("[requireUser] both Supabase and Privy verification failed:", e?.message ?? String(e));
    throw e;
  }
}
