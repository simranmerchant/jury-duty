import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { sendWebPushToUsers } from "@/lib/webpush";
import { validateFeedBet, buildFeedBetNotification } from "@/lib/feed";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { question, options, deadline, targeted_user_ids } = await req.json();

  const validationError = validateFeedBet({ question, options, deadline });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const normalizedOptions: { label: string }[] = (options as any[]).map((o) =>
    typeof o === "string" ? { label: o } : { label: o.label }
  );

  const [{ data: bet, error: betError }, { data: creatorData }] = await Promise.all([
    supabase
      .from("bets")
      .insert({
        event_id: null,
        creator_id: user.userId,
        question: question.trim(),
        deadline,
        visibility: "public",
        audience: "followers",
      })
      .select("id")
      .single(),
    supabase.from("balances").select("display_name").eq("user_id", user.userId).single(),
  ]);

  if (betError || !bet) return NextResponse.json({ error: betError?.message ?? "failed" }, { status: 500 });

  const { error: optError } = await supabase.from("bet_options").insert(
    normalizedOptions.map((o) => ({ bet_id: bet.id, label: o.label.trim() }))
  );
  if (optError) return NextResponse.json({ error: optError.message }, { status: 500 });

  // Notify followers (or specific targeted users)
  let followerIds: string[];
  if (Array.isArray(targeted_user_ids) && targeted_user_ids.length > 0) {
    followerIds = targeted_user_ids as string[];
  } else {
    const { data: followers } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.userId)
      .eq("status", "accepted");
    followerIds = (followers ?? []).map((r) => r.follower_id as string);
  }
  const creatorName = creatorData?.display_name ?? "someone";
  const notif = buildFeedBetNotification(creatorName, question);

  if (followerIds.length > 0) {
    await Promise.all([
      supabase.from("notifications").insert(followerIds.map((uid) => ({
        user_id: uid,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        data: { bet_id: bet.id },
      }))),
      sendPushToUsers(followerIds, { title: notif.title, body: notif.body, data: { bet_id: bet.id } }),
      sendWebPushToUsers(followerIds, { title: notif.title, body: notif.body, data: { bet_id: bet.id } }),
    ]);
  }

  await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: 25 });

  return NextResponse.json({ betId: bet.id }, { status: 201 });
}
