/**
 * Feed latency benchmark — run BEFORE and AFTER applying migration 053_feed_rpc.sql.
 *
 * Usage (from betsygal/):
 *   bun scripts/bench-feed.ts
 *   BENCH_USER_ID=<uuid> bun scripts/bench-feed.ts
 *
 * Bun auto-loads .env.local so SUPABASE env vars are available.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const RUNS = 5;
const CURSOR = null as string | null;
const SUPPORTS_POLL = true;
const SUPPORTS_EXPLORE = true;

// ── helpers ──────────────────────────────────────────────────────────────────

function p50(arr: number[]) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.5)];
}
function p95(arr: number[]) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)];
}
function avg(arr: number[]) {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// ── Approach A: current multi-query pipeline ──────────────────────────────────

async function runOld(userId: string): Promise<{ total: number; follows: number; queries: number } | null> {
  try {
    const t0 = performance.now();

    // Step 1 — serial: get followed user IDs
    const followStart = performance.now();
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .eq("status", "accepted");
    const followTime = Math.round(performance.now() - followStart);

    const followedIds = (followRows ?? []).map((r) => r.following_id as string);
    const feedUserIds = [...new Set([userId, ...followedIds])];

    // Step 2 — parallel: 4 content queries
    const queryStart = performance.now();
    const applyCursor = (q: any) => (CURSOR ? q.lt("created_at", CURSOR) : q);

    await Promise.all([
      applyCursor(
        supabase
          .from("bets")
          .select(
            "id,question,deadline,status,winning_option_id,creator_id,created_at,audience,bet_options!bet_id(id,label,tagged_user_id),bet_entries(user_id,option_id,points_staked,is_anonymous),balances:creator_id(display_name,avatar_url,username),bet_reactions(user_id,emoji),bet_comments!bet_id(id)"
          )
          .eq("audience", "followers")
          .in("creator_id", feedUserIds)
          .order("created_at", { ascending: false })
          .limit(25)
      ),
      applyCursor(
        supabase
          .from("posts")
          .select(
            "id,user_id,bet_id,caption,photo_url,targeted_user_ids,created_at,balances:user_id(display_name,avatar_url,username),post_likes(user_id),post_comments!post_id(id)"
          )
          .in("user_id", feedUserIds)
          .or(`targeted_user_ids.is.null,targeted_user_ids.cs.{${userId}}`)
          .order("created_at", { ascending: false })
          .limit(25)
      ),
      SUPPORTS_POLL
        ? applyCursor(
            supabase
              .from("poll_posts")
              .select(
                "id:poll_id,poll_id,user_id,caption,photo_url,targeted_user_ids,created_at,balances:user_id(display_name,avatar_url,username)"
              )
              .in("user_id", feedUserIds)
              .or(`targeted_user_ids.is.null,targeted_user_ids.cs.{${userId}}`)
              .order("created_at", { ascending: false })
              .limit(25)
          )
        : Promise.resolve({ data: [] }),
      SUPPORTS_EXPLORE
        ? applyCursor(
            supabase
              .from("explore_bet_posts")
              .select(
                "id,explore_bet_id,user_id,caption,photo_url,created_at,balances:user_id(display_name,avatar_url,username)"
              )
              .in("user_id", feedUserIds)
              .order("created_at", { ascending: false })
              .limit(25)
          )
        : Promise.resolve({ data: [] }),
    ]);

    const queryTime = Math.round(performance.now() - queryStart);
    const total = Math.round(performance.now() - t0);
    return { total, follows: followTime, queries: queryTime };
  } catch (e) {
    console.error("  [old approach error]", (e as Error).message);
    return null;
  }
}

// ── Approach B: single Postgres RPC ──────────────────────────────────────────

async function runNew(userId: string): Promise<number | null> {
  try {
    const t0 = performance.now();
    const { error } = await (supabase as any).rpc("get_feed", {
      p_user_id: userId,
      p_cursor: CURSOR,
      p_supports_poll_post: SUPPORTS_POLL,
      p_supports_explore_bet: SUPPORTS_EXPLORE,
    });
    if (error) {
      if (error.code === "PGRST202" || error.message?.includes("get_feed")) {
        return null; // function not created yet
      }
      throw error;
    }
    return Math.round(performance.now() - t0);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("get_feed") || msg.includes("PGRST202")) return null;
    console.error("  [rpc error]", msg);
    return null;
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve test user
  let userId = process.env.BENCH_USER_ID;
  if (!userId) {
    const { data } = await supabase.from("balances").select("user_id").limit(1).single();
    userId = data?.user_id;
  }
  if (!userId) {
    console.error("No user found. Set BENCH_USER_ID env var or ensure balances table has rows.");
    process.exit(1);
  }

  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .eq("status", "accepted");
  const followCount = followRows?.length ?? 0;

  console.log("\n=== Feed Latency Benchmark ===");
  console.log(`User: ${userId.slice(0, 8)}… (${followCount} follows)`);
  console.log(`Runs: ${RUNS} per approach (1 warmup)\n`);

  // Warmup
  await runOld(userId);

  // ── Approach A ──────────────────────────────────────────────────────────────
  console.log("--- Approach A: current (serial follows → 4 parallel queries) ---");
  const oldTotals: number[] = [];
  const oldFollows: number[] = [];
  const oldQueries: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await runOld(userId);
    if (!r) { console.log(`  Run ${i + 1}: ERROR`); continue; }
    oldTotals.push(r.total);
    oldFollows.push(r.follows);
    oldQueries.push(r.queries);
    console.log(`  Run ${i + 1}: ${r.total}ms  (follows: ${r.follows}ms, queries: ${r.queries}ms)`);
  }
  if (oldTotals.length > 0) {
    console.log(`  p50: ${p50(oldTotals)}ms | p95: ${p95(oldTotals)}ms | avg: ${avg(oldTotals)}ms`);
    console.log(`  follows avg: ${avg(oldFollows)}ms  queries avg: ${avg(oldQueries)}ms`);
  }

  // ── Approach B ──────────────────────────────────────────────────────────────
  console.log("\n--- Approach B: Postgres RPC (single round-trip) ---");
  const probe = await runNew(userId);
  if (probe === null) {
    console.log("  [not available — apply supabase/migrations/053_feed_rpc.sql first]\n");
    return;
  }

  const newTotals: number[] = [probe];
  for (let i = 1; i < RUNS; i++) {
    const ms = await runNew(userId);
    if (ms === null) { console.log(`  Run ${i + 1}: ERROR`); continue; }
    newTotals.push(ms);
    console.log(`  Run ${i + 1}: ${ms}ms`);
  }
  console.log(`  Run 1: ${probe}ms`);
  if (newTotals.length > 0) {
    console.log(`  p50: ${p50(newTotals)}ms | p95: ${p95(newTotals)}ms | avg: ${avg(newTotals)}ms`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  if (oldTotals.length > 0 && newTotals.length > 0) {
    const improvement = Math.round((1 - avg(newTotals) / avg(oldTotals)) * 100);
    console.log(`\n=== ${improvement > 0 ? `${improvement}% faster` : `${-improvement}% slower`} (avg: ${avg(oldTotals)}ms → ${avg(newTotals)}ms) ===\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
