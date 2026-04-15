import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { sendWebPushToUsers } from "@/lib/webpush";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: overdueBets, error } = await supabase
    .from("bets")
    .select("id, question, creator_id, event_id")
    .eq("status", "open")
    .eq("deadline_notified", false)
    .lt("deadline", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!overdueBets || overdueBets.length === 0) return NextResponse.json({ notified: 0 });

  const notifications = overdueBets.map((bet) => ({
    user_id: bet.creator_id,
    type: "bet_deadline",
    title: "the people need to know.",
    body: `"${bet.question}" is past its deadline. resolve your bet.`,
    data: { bet_id: bet.id },
  }));

  const pushPayloads = overdueBets.map((b) => ({
    title: "the people need to know.",
    body: `"${b.question}" is past its deadline. resolve it.`,
    data: { bet_id: b.id, event_id: b.event_id },
  }));

  const [notifResult, markResult] = await Promise.all([
    supabase.from("notifications").insert(notifications),
    supabase.from("bets").update({ deadline_notified: true }).in("id", overdueBets.map((b) => b.id)),
    ...overdueBets.map((b, i) => sendPushToUsers([b.creator_id], pushPayloads[i])),
    ...overdueBets.map((b, i) => sendWebPushToUsers([b.creator_id], pushPayloads[i])),
  ]);

  if (notifResult.error) console.error("cron: notification insert failed", notifResult.error.message);
  if (markResult.error) console.error("cron: deadline_notified update failed", markResult.error.message);

  return NextResponse.json({ notified: overdueBets.length });
}
