/**
 * Concurrent load stress test — simulates N users opening the app simultaneously.
 *
 * Tests the three heaviest endpoints hit on app open:
 *   1. get_feed RPC (feed tab)
 *   2. me/suggestions (people tab)
 *   3. me/notifications (notifications tab)
 *
 * Usage:
 *   bun scripts/stress-test.ts
 *   STRESS_USERS=50 bun scripts/stress-test.ts       # override concurrent user count
 *   STRESS_ROUNDS=3 bun scripts/stress-test.ts       # repeat N times
 *
 * Bun auto-loads .env.local so SUPABASE env vars are available.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CONCURRENT_USERS = parseInt(process.env.STRESS_USERS ?? "30");
const ROUNDS = parseInt(process.env.STRESS_ROUNDS ?? "3");

// ── stats helpers ──────────────────────────────────────────────────────────────

function stats(arr: number[]) {
  const s = [...arr].sort((a, b) => a - b);
  const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const p50 = s[Math.floor(s.length * 0.5)];
  const p95 = s[Math.floor(s.length * 0.95)];
  const p99 = s[Math.floor(s.length * 0.99)] ?? s[s.length - 1];
  const min = s[0];
  const max = s[s.length - 1];
  return { avg, p50, p95, p99, min, max };
}

function bar(ms: number, scale = 10): string {
  const blocks = Math.min(40, Math.round(ms / scale));
  return "█".repeat(blocks);
}

// ── per-user workload ──────────────────────────────────────────────────────────

async function runUser(userId: string): Promise<{
  feed: number | null;
  suggestions: number | null;
  notifications: number | null;
  errors: string[];
}> {
  const errors: string[] = [];

  // All three fire concurrently (same as app open — tabs load in parallel)
  const [feedResult, suggestionsResult, notificationsResult] = await Promise.all([
    // 1. Feed
    (async () => {
      const t = performance.now();
      try {
        const { error } = await (supabase as any).rpc("get_feed", {
          p_user_id: userId,
          p_cursor: null,
          p_supports_poll_post: true,
          p_supports_explore_bet: true,
        });
        if (error) { errors.push(`feed: ${error.message}`); return null; }
        return Math.round(performance.now() - t);
      } catch (e: any) {
        errors.push(`feed: ${e.message}`);
        return null;
      }
    })(),

    // 2. Suggestions (people tab)
    (async () => {
      const t = performance.now();
      try {
        const [followsRes, blocksRes, membershipsRes] = await Promise.all([
          supabase.from("follows").select("following_id").eq("follower_id", userId),
          supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId),
          supabase.from("event_guests").select("event_id").eq("user_id", userId),
        ]);
        if (followsRes.error) { errors.push(`suggestions: ${followsRes.error.message}`); return null; }
        return Math.round(performance.now() - t);
      } catch (e: any) {
        errors.push(`suggestions: ${e.message}`);
        return null;
      }
    })(),

    // 3. Notifications
    (async () => {
      const t = performance.now();
      try {
        const { error } = await supabase
          .from("notifications")
          .select("id, type, title, body, data, created_at, read")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) { errors.push(`notifications: ${error.message}`); return null; }
        return Math.round(performance.now() - t);
      } catch (e: any) {
        errors.push(`notifications: ${e.message}`);
        return null;
      }
    })(),
  ]);

  return { feed: feedResult, suggestions: suggestionsResult, notifications: notificationsResult, errors };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load real user IDs
  const { data: users, error } = await supabase
    .from("balances")
    .select("user_id")
    .limit(CONCURRENT_USERS);

  if (error || !users?.length) {
    console.error("Could not load users:", error?.message);
    process.exit(1);
  }

  const userIds = users.map((u) => u.user_id);
  const actual = userIds.length;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Jury Duty — Concurrent Load Stress Test`);
  console.log(`  ${actual} simultaneous users  ×  ${ROUNDS} round(s)`);
  console.log(`${"═".repeat(60)}\n`);

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`── Round ${round}/${ROUNDS} — firing ${actual} concurrent requests ──`);
    const t0 = performance.now();

    const results = await Promise.all(userIds.map(runUser));

    const wallMs = Math.round(performance.now() - t0);

    const feedTimes   = results.map((r) => r.feed).filter((x): x is number => x !== null);
    const suggTimes   = results.map((r) => r.suggestions).filter((x): x is number => x !== null);
    const notifTimes  = results.map((r) => r.notifications).filter((x): x is number => x !== null);
    const allErrors   = results.flatMap((r) => r.errors);

    const feedFail  = actual - feedTimes.length;
    const suggFail  = actual - suggTimes.length;
    const notifFail = actual - notifTimes.length;

    const printEndpoint = (label: string, times: number[], fails: number) => {
      if (times.length === 0) { console.log(`  ${label.padEnd(16)} ✗ ALL FAILED`); return; }
      const s = stats(times);
      const errStr = fails > 0 ? `  ⚠ ${fails} errors` : "";
      console.log(`  ${label.padEnd(16)} avg:${String(s.avg).padStart(5)}ms  p50:${String(s.p50).padStart(5)}ms  p95:${String(s.p95).padStart(5)}ms  p99:${String(s.p99).padStart(5)}ms  max:${String(s.max).padStart(5)}ms${errStr}`);
      console.log(`  ${"".padEnd(16)} ${bar(s.p95, 8)}`);
    };

    printEndpoint("feed",          feedTimes,  feedFail);
    printEndpoint("suggestions",   suggTimes,  suggFail);
    printEndpoint("notifications", notifTimes, notifFail);

    console.log(`\n  Wall time: ${wallMs}ms  (all ${actual} users served in parallel)`);

    if (allErrors.length > 0) {
      console.log(`\n  ⚠ Errors (${allErrors.length} total):`);
      const deduped = [...new Set(allErrors)];
      for (const e of deduped.slice(0, 10)) console.log(`    · ${e}`);
      if (deduped.length > 10) console.log(`    … and ${deduped.length - 10} more`);
    } else {
      console.log(`  ✓ Zero errors`);
    }

    const totalRequests = feedTimes.length + suggTimes.length + notifTimes.length;
    const rps = Math.round(totalRequests / (wallMs / 1000));
    console.log(`  Throughput: ~${rps} req/s\n`);
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`  Done. Check p95 and p99 — anything over 2000ms under load`);
  console.log(`  suggests Supabase connection pool pressure.`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
