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

  // Parallel: check existing like + fetch poll creator + current count
  const [{ data: existing }, { data: poll }, { count: currentCount }] = await Promise.all([
    supabase.from("poll_likes").select("user_id").eq("poll_id", id).eq("user_id", user.userId).maybeSingle(),
    supabase.from("polls").select("creator_id, question").eq("id", id).single(),
    supabase.from("poll_likes").select("*", { count: "exact", head: true }).eq("poll_id", id),
  ]);

  if (existing) {
    await supabase.from("poll_likes").delete().eq("poll_id", id).eq("user_id", user.userId);
  } else {
    await supabase.from("poll_likes").insert({ poll_id: id, user_id: user.userId });
  }

  const liked = !existing;
  const like_count = (currentCount ?? 0) + (liked ? 1 : -1);

  if (liked && poll && poll.creator_id !== user.userId) {
    const { data: liker } = await supabase.from("balances").select("display_name").eq("user_id", user.userId).single();
    const likerName = liker?.display_name ?? "someone";
    const body = poll.question ? `${likerName} liked your poll: "${poll.question}"` : `${likerName} liked your poll`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: poll.creator_id, type: "poll_like", title: "new like ❤️", body, data: { poll_id: id } }),
      sendPushToUsers([poll.creator_id], { title: "new like ❤️", body, data: { poll_id: id } }),
    ]);
  }

  return NextResponse.json({ liked, like_count });
}
