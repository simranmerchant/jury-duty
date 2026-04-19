import { PrivyClient } from "@privy-io/server-auth";

export const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// Call this at the top of every server action / route handler that mutates data.
// Returns the verified user or throws — never returns null.
export async function requireUser(accessToken: string) {
  try {
    const user = await privy.verifyAuthToken(accessToken);
    return user;
  } catch (e: any) {
    console.error("[requireUser] verifyAuthToken failed:", e?.message ?? String(e));
    throw e;
  }
}
