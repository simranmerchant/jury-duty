import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

// POST /api/v1/posts/[id]/likes — toggle like on a post
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  const [{ data: post }, { data: existing }] = await Promise.all([
    supabase.from("posts").select("user_id, bet_id, bets:bet_id(question)").eq("id", postId).single(),
    supabase.from("post_likes").select("id").eq("post_id", postId).eq("user_id", user.userId).maybeSingle(),
  ]);

  if (existing) {
    await supabase.from("post_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: user.userId });
  }

  const { count } = await supabase
    .from("post_likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (!existing && post && post.user_id !== user.userId) {
    const [{ data: liker }] = await Promise.all([
      supabase.from("balances").select("display_name").eq("user_id", user.userId).single(),
    ]);
    const likerName = liker?.display_name ?? "someone";
    const question = (post.bets as any)?.question;
    const notifBody = question ? `${likerName} liked your post on "${question}"` : `${likerName} liked your post`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: post.user_id, type: "post_like", title: "new like ❤️", body: notifBody, data: { post_id: postId } }),
      sendPushToUsers([post.user_id], { title: "new like ❤️", body: notifBody, data: { post_id: postId } }),
    ]);
  }

  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
