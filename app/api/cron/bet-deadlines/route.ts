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

  const now = new Date().toISOString();

  const [{ data: overdueBets, error: betsError }, { data: overdueExplore, error: exploreError }] = await Promise.all([
    supabase
      .from("bets")
      .select("id, question, creator_id, event_id")
      .eq("status", "open")
      .eq("deadline_notified", false)
      .lt("deadline", now),
    supabase
      .from("explore_bets")
      .select("id, question, creator_id")
      .eq("status", "open")
      .eq("deadline_notified", false)
      .not("closes_at", "is", null)
      .lt("closes_at", now),
  ]);

  if (betsError) return NextResponse.json({ error: betsError.message }, { status: 500 });
  if (exploreError) return NextResponse.json({ error: exploreError.message }, { status: 500 });

  const allBets = overdueBets ?? [];
  const allExplore = overdueExplore ?? [];

  if (allBets.length === 0 && allExplore.length === 0) return NextResponse.json({ notified: 0 });

  const betNotifications = allBets.map((bet) => ({
    user_id: bet.creator_id,
    type: "bet_deadline",
    title: "the people need to know.",
    body: `"${bet.question}" is past its deadline. resolve your bet.`,
    data: { bet_id: bet.id, event_id: bet.event_id },
  }));

  const exploreNotifications = allExplore.map((bet) => ({
    user_id: bet.creator_id,
    type: "bet_deadline",
    title: "the people need to know.",
    body: `"${bet.question}" is past its deadline. resolve your bet.`,
    data: { explore_bet_id: bet.id },
  }));

  const allNotifications = [...betNotifications, ...exploreNotifications];

  await Promise.all([
    allNotifications.length > 0 && supabase.from("notifications").insert(allNotifications),
    allBets.length > 0 && supabase.from("bets").update({ deadline_notified: true }).in("id", allBets.map((b) => b.id)),
    allExplore.length > 0 && supabase.from("explore_bets").update({ deadline_notified: true }).in("id", allExplore.map((b) => b.id)),
    ...allBets.map((b) => sendPushToUsers([b.creator_id], {
      title: "the people need to know.",
      body: `"${b.question}" is past its deadline. resolve it.`,
      data: { bet_id: b.id, event_id: b.event_id },
    })),
    ...allBets.map((b) => sendWebPushToUsers([b.creator_id], {
      title: "the people need to know.",
      body: `"${b.question}" is past its deadline. resolve it.`,
      data: { bet_id: b.id, event_id: b.event_id },
    })),
    ...allExplore.map((b) => sendPushToUsers([b.creator_id], {
      title: "the people need to know.",
      body: `"${b.question}" is past its deadline. resolve it.`,
      data: { explore_bet_id: b.id },
    })),
    ...allExplore.map((b) => sendWebPushToUsers([b.creator_id], {
      title: "the people need to know.",
      body: `"${b.question}" is past its deadline. resolve it.`,
      data: { explore_bet_id: b.id },
    })),
  ]);

  return NextResponse.json({ notified: allBets.length + allExplore.length });
}
