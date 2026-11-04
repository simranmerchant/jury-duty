import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { buildStakeNotificationBody } from "@/lib/privacy";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { bet_id, option_id, is_anonymous } = await req.json();
  if (!bet_id || !option_id) {
    return NextResponse.json({ error: "bet_id and option_id required" }, { status: 400 });
  }

  // Access control: verify user can see this bet before letting them vote
  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, audience, question, event_id, status, deadline")
    .eq("id", bet_id)
    .single();

  if (!bet) return NextResponse.json({ error: "bet not found" }, { status: 404 });
  if (bet.status !== "open") return NextResponse.json({ error: "bet is not open" }, { status: 422 });
  if (bet.deadline && new Date(bet.deadline) < new Date()) {
    return NextResponse.json({ error: "deadline has passed" }, { status: 422 });
  }

  const isCreator = bet.creator_id === user.userId;
  if (!isCreator) {
    const audience = (bet as any).audience as string;
    if (audience === "select_people") {
      const { data: invite } = await supabase
        .from("bet_invites")
        .select("user_id")
        .eq("bet_id", bet_id)
        .eq("user_id", user.userId)
        .single();
      if (!invite) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    } else if (audience === "followers") {
      const [{ data: follow }, { data: invite }] = await Promise.all([
        supabase.from("follows").select("follower_id").eq("follower_id", user.userId).eq("following_id", bet.creator_id).eq("status", "accepted").single(),
        supabase.from("bet_invites").select("user_id").eq("bet_id", bet_id).eq("user_id", user.userId).single(),
      ]);
      if (!follow && !invite) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("bet_entries")
    .insert({ bet_id, user_id: user.userId, option_id, points_staked: 1, is_anonymous: !!is_anonymous });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "already placed a bet" }, { status: 422 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify bet creator when someone else stakes
  if (!isCreator) {
    const question = (bet as any).question as string ?? "your prediction";
    const eventId = (bet as any).event_id as string | null;
    const notifData: Record<string, string> = { bet_id };
    if (eventId) notifData.event_id = eventId;
    const notifTitle = "new stake on your prediction 🗳️";
    let stakerName = "someone";
    if (!is_anonymous) {
      const { data: staker } = await supabase
        .from("balances")
        .select("display_name")
        .eq("user_id", user.userId)
        .single();
      stakerName = staker?.display_name ?? "someone";
    }
    const notifBody = buildStakeNotificationBody(stakerName, question, !!is_anonymous);
    await Promise.all([
      supabase.from("notifications").insert({
        user_id: bet.creator_id,
        type: "bet_staked",
        title: notifTitle,
        body: notifBody,
        data: notifData,
      }),
      sendPushToUsers([bet.creator_id], { title: notifTitle, body: notifBody, data: notifData }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
