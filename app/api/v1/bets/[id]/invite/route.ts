import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userIds } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  // Must be creator or already invited
  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, visibility, question, event_id, bet_invites(user_id)")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.visibility !== "private") return NextResponse.json({ error: "not a private bet" }, { status: 400 });

  const isCreator = bet.creator_id === user.userId;
  const isInvited = (bet.bet_invites as any[])?.some((inv) => inv.user_id === user.userId);
  if (!isCreator && !isInvited) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  // Only notify users not already invited
  const alreadyInvited = new Set((bet.bet_invites as any[]).map((i) => i.user_id));
  const newUserIds = (userIds as string[]).filter((uid) => !alreadyInvited.has(uid));

  const rows = (userIds as string[]).map((uid) => ({ bet_id: id, user_id: uid }));
  const { error } = await supabase
    .from("bet_invites")
    .upsert(rows, { onConflict: "bet_id,user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (newUserIds.length > 0) {
    const inviterName = await supabase
      .from("balances")
      .select("display_name")
      .eq("user_id", user.userId)
      .single()
      .then(({ data }) => data?.display_name ?? "someone");

    const notifications = newUserIds.map((uid) => ({
      user_id: uid,
      type: "bet_invited",
      title: "you've been added to a private bet 👀",
      body: "open the app to see it",
      data: { bet_id: id, event_id: bet.event_id },
    }));

    await supabase.from("notifications").insert(notifications);
    await sendPushToUsers(newUserIds, {
      title: "you've been added to a private bet 👀",
      body: "open the app to see it",
      data: { event_id: bet.event_id },
    });
  }

  return NextResponse.json({ ok: true });
}
