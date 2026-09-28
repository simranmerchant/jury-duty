import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Vercel cron — runs every 5 minutes to keep serverless functions warm.
// Fires lightweight queries against the three most-hit endpoints so the
// connection pool stays open and cold-start latency doesn't pile up when
// many users open the app simultaneously.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t = Date.now();

  await Promise.all([
    supabase.from("posts").select("id").limit(1),
    supabase.from("balances").select("user_id").limit(1),
    supabase.from("notifications").select("id").limit(1),
    supabase.from("events").select("id").limit(1),
    supabase.from("bet_entries").select("bet_id").limit(1),
  ]);

  return NextResponse.json({ ok: true, ms: Date.now() - t });
}
