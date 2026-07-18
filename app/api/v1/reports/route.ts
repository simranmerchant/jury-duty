import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { notifyAdmin } from "@/lib/notify-admin";

const VALID_REASONS = ["spam", "harassment", "inappropriate content", "other"];

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { reported_bet_id, reported_poll_id, reported_explore_bet_id, reported_user_id, reason } = await req.json();

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "invalid reason" }, { status: 400 });
  }
  if (!reported_bet_id && !reported_poll_id && !reported_explore_bet_id && !reported_user_id) {
    return NextResponse.json({ error: "must report a bet, poll, or user" }, { status: 400 });
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.userId,
    reported_bet_id: reported_bet_id ?? null,
    reported_poll_id: reported_poll_id ?? null,
    reported_explore_bet_id: reported_explore_bet_id ?? null,
    reported_user_id: reported_user_id ?? null,
    reason,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyAdmin(
    `[jury duty] new report: ${reason}`,
    `Reporter: ${user.userId}\nBet ID: ${reported_bet_id ?? "n/a"}\nPoll ID: ${reported_poll_id ?? "n/a"}\nExplore Bet ID: ${reported_explore_bet_id ?? "n/a"}\nUser ID: ${reported_user_id ?? "n/a"}\nReason: ${reason}`
  );

  return NextResponse.json({ ok: true });
}
