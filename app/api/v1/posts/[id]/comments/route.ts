import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { validateComment } from "@/lib/comment-validation";
import { sendPushToUsers } from "@/lib/push";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, body, gif_url, created_at, user_id, balances:user_id(display_name, avatar_url, username)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const { body, gif_url } = await req.json().catch(() => ({}));

  const validation = validateComment(body, gif_url);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const [{ data: post }, insertResult] = await Promise.all([
    supabase.from("posts").select("user_id, bets:bet_id(question)").eq("id", postId).single(),
    supabase.from("post_comments")
      .insert({ post_id: postId, user_id: user.userId, ...(validation.body ? { body: validation.body } : {}), ...(validation.gif_url ? { gif_url: validation.gif_url } : {}) })
      .select("id, body, gif_url, created_at, user_id, balances:user_id(display_name, avatar_url, username)")
      .single(),
  ]);

  if (insertResult.error) return NextResponse.json({ error: insertResult.error.message }, { status: 500 });

  if (post && post.user_id !== user.userId) {
    const commenterName = (insertResult.data as any).balances?.display_name ?? "someone";
    const question = (post.bets as any)?.question;
    const notifTitle = question ? `comment on "${question}"` : "new comment on your post";
    const notifBody = validation.body ? `${commenterName}: ${validation.body.slice(0, 80)}` : `${commenterName} left a GIF`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: post.user_id, type: "post_comment", title: notifTitle, body: notifBody, data: { post_id: postId } }),
      sendPushToUsers([post.user_id], { title: notifTitle, body: notifBody, data: { post_id: postId } }),
    ]);
  }

  return NextResponse.json({ comment: insertResult.data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  await Promise.all([
    supabase.from("notifications").delete().like("data::text", `%${commentId}%`),
    supabase.from("post_comments").delete().eq("id", commentId).eq("post_id", postId).eq("user_id", user.userId),
  ]);

  return NextResponse.json({ ok: true });
}
