import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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

  const [{ data: accepter }, { data: requester }, { data: alreadyFollows }] = await Promise.all([
    supabase.from("balances").select("display_name, username").eq("user_id", user.userId).single(),
    supabase.from("balances").select("display_name, username").eq("user_id", requesterId).single(),
    supabase.from("follows").select("status").eq("follower_id", user.userId).eq("following_id", requesterId).maybeSingle(),
  ]);

  const accepterName = accepter?.display_name ?? accepter?.username ?? "someone";
  const requesterName = requester?.display_name ?? requester?.username ?? "someone";
  const alreadyFollowing = alreadyFollows?.status === "accepted";

  // Convert the follow_request notification in accepter's inbox → new_follower
  await supabase
    .from("notifications")
    .update({
      type: "new_follower",
      title: "new follower",
      body: `${requesterName} is now following you.`,
      data: { user_id: requesterId, username: requester?.username ?? null, already_following: alreadyFollowing },
    })
    .eq("user_id", user.userId)
    .eq("type", "follow_request")
    .contains("data", { user_id: requesterId });

  const notif = buildAcceptNotification(accepterName);
  const notifData = { user_id: user.userId, username: accepter?.username ?? null };
  await Promise.all([
    supabase.from("notifications").insert({ user_id: requesterId, ...notif, data: notifData }),
    sendPushToUsers([requesterId], { ...notif, data: notifData }),
  ]);

  return NextResponse.json({ ok: true, already_following: alreadyFollowing, requester_username: requester?.username ?? null, requester_name: requesterName });
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

  // Remove the follow_request notification so it doesn't resurface on refresh
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.userId)
    .eq("type", "follow_request")
    .contains("data", { user_id: requesterId });

  return NextResponse.json({ ok: true });
}
