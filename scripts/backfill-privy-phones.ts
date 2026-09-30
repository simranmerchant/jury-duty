/**
 * Backfill phone numbers from Privy into the balances table.
 *
 * Privy holds the canonical phone number for every user — our DB doesn't.
 * This script pages through all Privy users, extracts their phone numbers,
 * and writes them to balances.phone so the Supabase Auth migration can
 * match users by phone on first login.
 *
 * Usage (from betsygal/):
 *   bun scripts/backfill-privy-phones.ts
 *
 * Requires in environment:
 *   NEXT_PUBLIC_PRIVY_APP_ID
 *   PRIVY_APP_SECRET
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY with enough perms)
 *   NEXT_PUBLIC_SUPABASE_URL
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required env vars — check PRIVY_APP_ID, PRIVY_APP_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const authHeader = "Basic " + Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString("base64");

type PrivyUser = {
  id: string; // did:privy:...
  linked_accounts?: { type: string; phoneNumber?: string; number?: string }[];
};

async function fetchAllPrivyUsers(): Promise<PrivyUser[]> {
  const users: PrivyUser[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (true) {
    page++;
    const url = new URL("https://auth.privy.io/api/v1/users");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: authHeader,
        "privy-app-id": PRIVY_APP_ID,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Privy API error ${res.status}: ${body}`);
    }

    const data = await res.json() as { data: PrivyUser[]; next_cursor?: string };
    users.push(...data.data);
    console.log(`  page ${page}: fetched ${data.data.length} users (total so far: ${users.length})`);

    if (!data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return users;
}

function extractPhone(user: PrivyUser): string | null {
  const phoneAccount = (user.linked_accounts ?? []).find((a) => a.type === "phone");
  const raw = phoneAccount?.phoneNumber ?? phoneAccount?.number ?? null;
  return raw ? normalizePhone(raw) : null;
}

function normalizePhone(raw: string): string {
  // Ensure E.164 format (+1XXXXXXXXXX)
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("1") && digits.length === 11 ? `+${digits}` : `+${digits}`;
}

async function main() {
  console.log("Fetching all Privy users...");
  const privyUsers = await fetchAllPrivyUsers();
  console.log(`\nTotal Privy users: ${privyUsers.length}`);

  const withPhone = privyUsers.filter((u) => extractPhone(u) !== null);
  const withoutPhone = privyUsers.length - withPhone.length;
  console.log(`  with phone:    ${withPhone.length}`);
  console.log(`  without phone: ${withoutPhone} (email/social only — skipped)`);

  if (withPhone.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  console.log("\nWriting to balances.phone...");
  let updated = 0;
  let notFound = 0;

  // Batch in groups of 50 to avoid hitting Supabase limits
  const BATCH = 50;
  for (let i = 0; i < withPhone.length; i += BATCH) {
    const batch = withPhone.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (user) => {
        const phone = extractPhone(user)!;
        const { error } = await supabase
          .from("balances")
          .update({ phone })
          .eq("user_id", user.id);

        if (error) {
          console.warn(`  WARN: failed to update ${user.id}: ${error.message}`);
        } else {
          updated++;
        }
      })
    );
    console.log(`  written ${Math.min(i + BATCH, withPhone.length)} / ${withPhone.length}`);
  }

  // Check how many rows in balances still have no phone
  const { count } = await supabase
    .from("balances")
    .select("*", { count: "exact", head: true })
    .is("phone", null);

  console.log(`\nDone.`);
  console.log(`  rows updated:       ${updated}`);
  console.log(`  balances rows with no phone: ${count ?? "unknown"}`);

  if ((count ?? 0) > 0) {
    console.log("  (these users have no phone in Privy — email/wallet-only accounts)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
