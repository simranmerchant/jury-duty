import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read, created_at")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const raw = notifications ?? [];

  // For new_follower notifications, hydrate already_following from the follows table
  const followerUserIds = raw
    .filter((n) => n.type === "new_follower" && n.data?.user_id)
    .map((n) => n.data.user_id as string);

  let followingSet = new Set<string>();
  if (followerUserIds.length > 0) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.userId)
      .eq("status", "accepted")
      .in("following_id", followerUserIds);
    followingSet = new Set((followRows ?? []).map((r) => r.following_id));
  }

  const hydrated = raw.map((n) => {
    if (n.type !== "new_follower" || !n.data?.user_id) return n;
    return { ...n, data: { ...n.data, already_following: followingSet.has(n.data.user_id) } };
  });

  const unreadCount = hydrated.filter((n) => !n.read).length;

  return NextResponse.json({ notifications: hydrated, unreadCount });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Mark all as read
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.userId)
    .eq("read", false);

  return NextResponse.json({ ok: true });
}
