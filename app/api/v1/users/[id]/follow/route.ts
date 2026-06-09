import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

// POST /api/v1/users/[id]/follow — follow or request to follow
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: targetId } = await params;
  if (targetId === user.userId) return NextResponse.json({ error: "cannot follow yourself" }, { status: 400 });

  const { data: target } = await supabase
    .from("balances")
    .select("user_id, display_name, username, is_private")
    .eq("user_id", targetId)
    .single();

  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const status = target.is_private ? "pending" : "accepted";

  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: user.userId, following_id: targetId, status }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: follower } = await supabase
    .from("balances")
    .select("display_name, username")
    .eq("user_id", user.userId)
    .single();

  const followerName = follower?.display_name ?? follower?.username ?? "someone";

  if (target.is_private) {
    await Promise.all([
      supabase.from("notifications").insert({
        user_id: targetId,
        type: "follow_request",
        title: "new follow request",
        body: `${followerName} wants to follow you.`,
        data: { user_id: user.userId },
      }),
      sendPushToUsers([targetId], {
        title: "new follow request",
        body: `${followerName} wants to follow you.`,
        data: { user_id: user.userId },
      }),
    ]);
  } else {
    await Promise.all([
      supabase.from("notifications").insert({
        user_id: targetId,
        type: "new_follower",
        title: "new follower",
        body: `${followerName} started following you.`,
        data: { user_id: user.userId },
      }),
      sendPushToUsers([targetId], {
        title: "new follower",
        body: `${followerName} started following you.`,
        data: { user_id: user.userId },
      }),
    ]);
  }

  return NextResponse.json({ status });
}

// DELETE /api/v1/users/[id]/follow — unfollow or cancel request
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: targetId } = await params;

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.userId)
    .eq("following_id", targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
