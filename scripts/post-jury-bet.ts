/**
 * Post a bet as "The Jury" service account.
 *
 * Usage:
 *   bun run scripts/post-jury-bet.ts
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Edit the CONFIG block below, then run.
 */

import { createClient } from "@supabase/supabase-js";

// ── Configure the bet here ──────────────────────────────────────────────────
const CONFIG = {
  question: "Will the first Jury Duty app review come in this week?",
  options: ["yes", "no"],
  /** ISO string or anything new Date() accepts */
  deadline: "2026-11-10T23:59:00Z",
};
// ───────────────────────────────────────────────────────────────────────────

const JURY_USER_ID = "10000000-0000-0000-0000-000000000001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

async function main() {
  const deadline = new Date(CONFIG.deadline);
  if (isNaN(deadline.getTime())) {
    console.error("Invalid deadline:", CONFIG.deadline);
    process.exit(1);
  }

  const { data: bet, error: betErr } = await supabase
    .from("bets")
    .insert({
      question: CONFIG.question,
      creator_id: JURY_USER_ID,
      audience: "followers",
      deadline: deadline.toISOString(),
      status: "open",
    })
    .select("id")
    .single();

  if (betErr || !bet) {
    console.error("Failed to create bet:", betErr?.message);
    process.exit(1);
  }

  const { error: optErr } = await supabase
    .from("bet_options")
    .insert(CONFIG.options.map((label) => ({ bet_id: bet.id, label })));

  if (optErr) {
    console.error("Failed to create options:", optErr.message);
    process.exit(1);
  }

  console.log(`\n✅ Bet posted as The Jury`);
  console.log(`   id:       ${bet.id}`);
  console.log(`   question: ${CONFIG.question}`);
  console.log(`   options:  ${CONFIG.options.join(" | ")}`);
  console.log(`   deadline: ${deadline.toLocaleString()}\n`);
}

main();
