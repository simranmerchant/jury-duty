import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

// POST /api/v1/explore-bets/[id]/comments/[commentId]/likes — toggle like
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const [{ data: comment }, { data: existing }] = await Promise.all([
    supabase.from("explore_bet_comments").select("user_id, body").eq("id", commentId).single(),
    supabase.from("explore_bet_comment_likes").select("user_id").eq("explore_bet_comment_id", commentId).eq("user_id", user.userId).single(),
  ]);

  if (existing) {
    await supabase.from("explore_bet_comment_likes").delete().eq("explore_bet_comment_id", commentId).eq("user_id", user.userId);
  } else {
    await supabase.from("explore_bet_comment_likes").insert({ explore_bet_comment_id: commentId, user_id: user.userId });
  }

  if (!existing && comment && comment.user_id !== user.userId) {
    const { data: liker } = await supabase.from("balances").select("display_name").eq("user_id", user.userId).single();
    const likerName = liker?.display_name ?? "someone";
    const preview = comment.body ? `"${comment.body.slice(0, 60)}"` : "your comment";
    const notifBody = `${likerName} liked ${preview}`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: comment.user_id, type: "comment_like", title: "new like ❤️", body: notifBody, data: { explore_bet_comment_id: commentId } }),
      sendPushToUsers([comment.user_id], { title: "new like ❤️", body: notifBody, data: { explore_bet_comment_id: commentId } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
