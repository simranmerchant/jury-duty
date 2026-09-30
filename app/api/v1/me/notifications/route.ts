import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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

  // For new_follower notifications, hydrate follow_back_status from the follows table
  const followerUserIds = raw
    .filter((n) => n.type === "new_follower" && n.data?.user_id)
    .map((n) => n.data.user_id as string);

  let followStatusMap = new Map<string, "pending" | "accepted">();
  if (followerUserIds.length > 0) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id, status")
      .eq("follower_id", user.userId)
      .in("following_id", followerUserIds)
      .in("status", ["accepted", "pending"]);
    for (const r of followRows ?? []) {
      followStatusMap.set(r.following_id, r.status as "pending" | "accepted");
    }
  }

  const hydrated = raw.map((n) => {
    if (n.type !== "new_follower" || !n.data?.user_id) return n;
    const follow_back_status = followStatusMap.get(n.data.user_id) ?? "none";
    return { ...n, data: { ...n.data, follow_back_status } };
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
