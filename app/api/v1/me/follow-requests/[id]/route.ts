import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { buildAcceptNotification } from "@/lib/follow";

// POST /api/v1/me/follow-requests/[id]/accept — accept a pending follow request
// DELETE /api/v1/me/follow-requests/[id] — decline a pending follow request

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: requesterId } = await params;

  const { error } = await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", requesterId)
    .eq("following_id", user.userId)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: accepter } = await supabase
    .from("balances")
    .select("display_name, username")
    .eq("user_id", user.userId)
    .single();

  const accepterName = accepter?.display_name ?? accepter?.username ?? "someone";
  const notif = buildAcceptNotification(accepterName);

  await Promise.all([
    supabase.from("notifications").insert({ user_id: requesterId, ...notif, data: { user_id: user.userId } }),
    sendPushToUsers([requesterId], { ...notif, data: { user_id: user.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: requesterId } = await params;

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", requesterId)
    .eq("following_id", user.userId)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
