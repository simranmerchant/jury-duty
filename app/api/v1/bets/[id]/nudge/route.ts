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

  const { id: betId } = await params;
  const { target_user_id } = await req.json();

  if (!target_user_id || typeof target_user_id !== "string") {
    return NextResponse.json({ error: "target_user_id required" }, { status: 400 });
  }

  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, question, status, deadline, event_id")
    .eq("id", betId)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.creator_id !== user.userId) return NextResponse.json({ error: "only the creator can nudge" }, { status: 403 });
  if (bet.status !== "open") return NextResponse.json({ error: "bet already resolved" }, { status: 422 });
  if (new Date(bet.deadline) > new Date()) return NextResponse.json({ error: "deadline hasn't passed yet" }, { status: 422 });

  const { data: entry } = await supabase
    .from("bet_entries")
    .select("user_id")
    .eq("bet_id", betId)
    .eq("user_id", target_user_id)
    .single();

  if (!entry) return NextResponse.json({ error: "that person hasn't staked on this bet" }, { status: 422 });

  const { data: creator } = await supabase
    .from("balances")
    .select("display_name, username")
    .eq("user_id", user.userId)
    .single();

  const creatorName = creator?.display_name ?? creator?.username ?? "someone";
  const title = "can you resolve this? 🙏";
  const body = `${creatorName} is asking you to call it on "${bet.question}"`;
  const notifData: Record<string, string> = { bet_id: betId };
  if (bet.event_id) notifData.event_id = bet.event_id;

  await Promise.all([
    supabase.from("notifications").insert({
      user_id: target_user_id,
      type: "nudge_resolve",
      title,
      body,
      data: notifData,
    }),
    sendPushToUsers([target_user_id], { title, body, data: notifData }),
  ]);

  return NextResponse.json({ ok: true });
}
