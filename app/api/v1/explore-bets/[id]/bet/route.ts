import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

// POST /api/v1/explore-bets/[id]/bet — pick a side on an explore bet
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { side } = body;

  if (!["a", "b"].includes(side)) return NextResponse.json({ error: "side must be 'a' or 'b'" }, { status: 400 });

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id, status, closes_at, question, creator_id")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.status !== "open") return NextResponse.json({ error: "betting is closed" }, { status: 422 });
  if (bet.closes_at && new Date(bet.closes_at) < new Date()) {
    return NextResponse.json({ error: "betting period has ended" }, { status: 422 });
  }

  const { error } = await supabase
    .from("explore_bet_entries")
    .insert({ explore_bet_id: id, user_id: user.userId, side, points_wagered: 1 });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "already placed a bet on this" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (bet.creator_id && bet.creator_id !== user.userId) {
    const { data: voter } = await supabase.from("balances").select("display_name").eq("user_id", user.userId).single();
    const voterName = voter?.display_name ?? "someone";
    const notifBody = `${voterName} voted on "${bet.question}"`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: bet.creator_id, type: "explore_bet_vote", title: "new vote 🗳️", body: notifBody, data: { explore_bet_id: id } }),
      sendPushToUsers([bet.creator_id], { title: "new vote 🗳️", body: notifBody, data: { explore_bet_id: id } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
