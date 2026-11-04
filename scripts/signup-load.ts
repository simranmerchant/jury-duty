/**
 * Sign-up load test — simulates N users creating accounts simultaneously.
 *
 * Mirrors the two DB operations in /api/v1/auth/init:
 *   1. upsert into balances (ignoreDuplicates)
 *   2. select points/display_name/username back
 *
 * Privy token verification is omitted — this tests the DB layer, which is
 * the actual bottleneck. Vercel and Privy both scale horizontally; Supabase's
 * connection pool is fixed (typically 60 on Pro).
 *
 * Usage:
 *   bun scripts/signup-load.ts
 *   SIGNUP_USERS=200 bun scripts/signup-load.ts     # concurrent user count
 *   SIGNUP_ROUNDS=5  bun scripts/signup-load.ts     # repeat N times
 *
 * Bun auto-loads .env.local so SUPABASE env vars are available.
 * Test rows are cleaned up automatically after each run.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CONCURRENT_USERS = parseInt(process.env.SIGNUP_USERS ?? "50");
const ROUNDS = parseInt(process.env.SIGNUP_ROUNDS ?? "3");
const RUN_ID = `signup-load-${Date.now()}`;

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

// ── per-user sign-up simulation ────────────────────────────────────────────────

async function simulateSignup(userId: string): Promise<{
  upsert: number | null;
  select: number | null;
  errors: string[];
}> {
  const errors: string[] = [];

  // Single round-trip via init_user RPC — mirrors the optimised auth/init route.
  const t1 = performance.now();
  try {
    const { data, error } = await (supabase as any).rpc("init_user", { p_user_id: userId });
    if (error) { errors.push(`init_user: ${error.message}`); return { upsert: null, select: null, errors }; }
    if (!data || (Array.isArray(data) && data.length === 0)) {
      errors.push(`init_user: no row returned`);
      return { upsert: null, select: null, errors };
    }
  } catch (e: any) {
    errors.push(`init_user: ${e.message}`);
    return { upsert: null, select: null, errors };
  }
  const rpcMs = Math.round(performance.now() - t1);

  return { upsert: rpcMs, select: 0, errors };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Jury Duty — Sign-up Load Test`);
  console.log(`  ${CONCURRENT_USERS} simultaneous sign-ups  ×  ${ROUNDS} round(s)`);
  console.log(`  (DB only — Privy verification excluded)`);
  console.log(`${"═".repeat(60)}\n`);

  const allRoundUpserts: number[] = [];
  const allRoundSelects: number[] = [];

  for (let round = 1; round <= ROUNDS; round++) {
    // Fresh unique user IDs each round so we're always inserting new rows
    const userIds = Array.from(
      { length: CONCURRENT_USERS },
      (_, i) => `${RUN_ID}-r${round}-${i}`
    );

    console.log(`── Round ${round}/${ROUNDS} — ${CONCURRENT_USERS} concurrent sign-ups ──`);
    const t0 = performance.now();

    const results = await Promise.all(userIds.map(simulateSignup));

    const wallMs = Math.round(performance.now() - t0);

    const upsertTimes = results.map((r) => r.upsert).filter((x): x is number => x !== null);
    const selectTimes = results.map((r) => r.select).filter((x): x is number => x !== null);
    const allErrors   = results.flatMap((r) => r.errors);

    allRoundUpserts.push(...upsertTimes);
    allRoundSelects.push(...selectTimes);

    const printRow = (label: string, times: number[], fails: number) => {
      if (times.length === 0) { console.log(`  ${label.padEnd(10)} ✗ ALL FAILED`); return; }
      const s = stats(times);
      const errStr = fails > 0 ? `  ⚠ ${fails} failed` : "";
      console.log(
        `  ${label.padEnd(10)}` +
        `  avg:${String(s.avg).padStart(5)}ms` +
        `  p50:${String(s.p50).padStart(5)}ms` +
        `  p95:${String(s.p95).padStart(5)}ms` +
        `  p99:${String(s.p99).padStart(5)}ms` +
        `  max:${String(s.max).padStart(5)}ms` +
        errStr
      );
      console.log(`  ${"".padEnd(10)}  ${bar(s.p95, 8)}`);
    };

    printRow("init_user", upsertTimes, CONCURRENT_USERS - upsertTimes.length);

    console.log(`\n  Wall time: ${wallMs}ms`);

    if (allErrors.length > 0) {
      console.log(`\n  ⚠ Errors (${allErrors.length}):`);
      const deduped = [...new Set(allErrors)];
      for (const e of deduped.slice(0, 10)) console.log(`    · ${e}`);
      if (deduped.length > 10) console.log(`    … and ${deduped.length - 10} more`);
    } else {
      console.log(`  ✓ Zero errors`);
    }

    const rps = Math.round((upsertTimes.length + selectTimes.length) / (wallMs / 1000));
    console.log(`  Throughput: ~${rps} req/s\n`);
  }

  // ── aggregate across all rounds ──────────────────────────────────────────────
  if (ROUNDS > 1 && allRoundUpserts.length > 0) {
    console.log(`── Aggregate across all ${ROUNDS} rounds ──────────────────────────`);
    const u = stats(allRoundUpserts);
    const s = stats(allRoundSelects);
    console.log(`  upsert     p95:${String(u.p95).padStart(5)}ms  p99:${String(u.p99).padStart(5)}ms  max:${String(u.max).padStart(5)}ms`);
    console.log(`  select     p95:${String(s.p95).padStart(5)}ms  p99:${String(s.p99).padStart(5)}ms  max:${String(s.max).padStart(5)}ms`);
    console.log();
  }

  console.log(`── Cleanup ────────────────────────────────────────────────────`);
  const { error: delErr } = await supabase
    .from("balances")
    .delete()
    .like("user_id", `${RUN_ID}%`);
  if (delErr) {
    console.log(`  ⚠ Cleanup failed: ${delErr.message}`);
    console.log(`  Run manually: DELETE FROM balances WHERE user_id LIKE '${RUN_ID}%'`);
  } else {
    console.log(`  ✓ Removed ${CONCURRENT_USERS * ROUNDS} test rows`);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  p95 upsert > 500ms → Supabase connection pool pressure`);
  console.log(`  p95 upsert > 2000ms → reduce SIGNUP_USERS or upgrade plan`);
  console.log(`  Errors on upsert → check balances constraints / pool limits`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
