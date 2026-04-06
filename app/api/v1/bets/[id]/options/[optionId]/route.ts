import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: betId, optionId } = await params;

  const { data: bet } = await supabase
    .from("bets")
    .select("id, creator_id, status, question, event_id")
    .eq("id", betId)
    .single();

  if (!bet) return NextResponse.json({ error: "bet not found" }, { status: 404 });
  if (bet.creator_id !== user.userId) return NextResponse.json({ error: "only the bet creator can tag options" }, { status: 403 });
  if (bet.status !== "open") return NextResponse.json({ error: "bet is already resolved" }, { status: 422 });

  // Verify option belongs to this bet
  const { data: option } = await supabase
    .from("bet_options")
    .select("id")
    .eq("id", optionId)
    .eq("bet_id", betId)
    .single();

  if (!option) return NextResponse.json({ error: "option not found" }, { status: 404 });

  const body = await req.json();
  const { tagged_user_id } = body;
  // tagged_user_id can be a string (tag) or null (untag). Ignore any other fields.

  if (tagged_user_id !== null && tagged_user_id !== undefined) {
    // Verify the target user exists
    const { data: targetUser } = await supabase
      .from("balances")
      .select("user_id")
      .eq("user_id", tagged_user_id)
      .single();

    if (!targetUser) return NextResponse.json({ error: "user not found" }, { status: 404 });

    // Verify they are a mutual — caller and target share at least one event/group
    const [{ data: callerGroups }, { data: creatorData }] = await Promise.all([
      supabase.from("event_guests").select("event_id").eq("user_id", user.userId),
      supabase.from("balances").select("display_name").eq("user_id", user.userId).single(),
    ]);

    const callerEventIds = (callerGroups ?? []).map((g) => g.event_id);

    const { data: sharedMembership } = await supabase
      .from("event_guests")
      .select("event_id")
      .eq("user_id", tagged_user_id)
      .in("event_id", callerEventIds)
      .limit(1);

    if (!sharedMembership || sharedMembership.length === 0) {
      return NextResponse.json({ error: "you can only tag mutual contacts" }, { status: 403 });
    }

    const { error } = await supabase
      .from("bet_options")
      .update({ tagged_user_id })
      .eq("id", optionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the tagged user (skip if they tagged themselves)
    if (tagged_user_id !== user.userId) {
      const creatorName = creatorData?.display_name ?? "someone";
      await Promise.all([
        supabase.from("notifications").insert({
          user_id: tagged_user_id,
          type: "bet_tagged",
          title: "you've been put on the board 🎯",
          body: `${creatorName} named you in a bet: "${bet.question}"`,
          data: { bet_id: betId, event_id: bet.event_id },
        }),
        sendPushToUsers([tagged_user_id], {
          title: "you've been put on the board 🎯",
          body: `${creatorName} named you in a bet: "${bet.question}"`,
          data: { event_id: bet.event_id },
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  }

  // Untagging — no notification needed
  const { error } = await supabase
    .from("bet_options")
    .update({ tagged_user_id: null })
    .eq("id", optionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
