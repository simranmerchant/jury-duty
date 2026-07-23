import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { validateComment } from "@/lib/comment-validation";
import { extractMentions } from "@/lib/mention";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: betId } = await params;

  const { data, error } = await supabase
    .from("bet_comments")
    .select("id, body, gif_url, created_at, user_id, parent_id, balances(display_name, avatar_url, username), comment_likes(user_id)")
    .eq("bet_id", betId)
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

  const { id: betId } = await params;
  const { body, parentId, gif_url } = await req.json();

  const validation = validateComment(body, gif_url);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const insert: Record<string, unknown> = { bet_id: betId, user_id: user.userId };
  if (validation.body) insert.body = validation.body;
  if (validation.gif_url) insert.gif_url = validation.gif_url;
  if (parentId) insert.parent_id = parentId;

  const { data, error } = await supabase
    .from("bet_comments")
    .insert(insert)
    .select("id, body, gif_url, created_at, user_id, parent_id, balances(display_name, avatar_url, username), comment_likes(user_id)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch bet + sender profile + parent comment author for notifications
  const commentBody = validation.body ?? "";
  const mentionedUsernames = extractMentions(commentBody);
  const [senderProfileRes, betRes, mentionedRes, parentCommentRes] = await Promise.all([
    supabase.from("balances").select("display_name, username").eq("user_id", user.userId).single(),
    supabase.from("bets").select("event_id, creator_id, question").eq("id", betId).single(),
    mentionedUsernames.length > 0
      ? supabase.from("balances").select("user_id, username").in("username", mentionedUsernames)
      : Promise.resolve({ data: [] }),
    parentId
      ? supabase.from("bet_comments").select("user_id").eq("id", parentId).single()
      : Promise.resolve({ data: null }),
  ]);

  const senderName = senderProfileRes.data?.display_name ?? senderProfileRes.data?.username ?? "someone";
  const eventId = betRes.data?.event_id ?? null;
  const creatorId = betRes.data?.creator_id ?? null;
  const notifData = { bet_id: betId, ...(eventId ? { event_id: eventId } : {}) };

  // Notify @mentioned users
  const mentionedIds = ((mentionedRes as { data: { user_id: string }[] | null }).data ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== user.userId);

  if (mentionedIds.length > 0) {
    await Promise.all([
      supabase.from("notifications").insert(
        mentionedIds.map((uid) => ({
          user_id: uid,
          type: "comment_mention",
          title: `${senderName} mentioned you`,
          body: commentBody.slice(0, 80),
          data: notifData,
        }))
      ),
      sendPushToUsers(mentionedIds, {
        title: `${senderName} mentioned you in a comment`,
        body: commentBody.slice(0, 80),
        data: notifData,
      }),
    ]);
  }

  // Notify parent commenter on reply (skip if they're the sender or already mentioned)
  const parentAuthorId = (parentCommentRes as { data: { user_id: string } | null }).data?.user_id ?? null;
  if (parentAuthorId && parentAuthorId !== user.userId && !mentionedIds.includes(parentAuthorId)) {
    await Promise.all([
      supabase.from("notifications").insert({
        user_id: parentAuthorId,
        type: "comment_reply",
        title: `${senderName} replied to your comment`,
        body: commentBody.slice(0, 80) || "sent a GIF",
        data: notifData,
      }),
      sendPushToUsers([parentAuthorId], {
        title: `${senderName} replied to your comment`,
        body: commentBody.slice(0, 80) || "sent a GIF",
        data: notifData,
      }),
    ]);
  }

  // Notify bet creator when someone else comments (skip if creator is the commenter, parent author, or already mentioned)
  if (creatorId && creatorId !== user.userId && creatorId !== parentAuthorId && !mentionedIds.includes(creatorId)) {
    await Promise.all([
      supabase.from("notifications").insert({
        user_id: creatorId,
        type: "comment_on_bet",
        title: `${senderName} commented on your prediction`,
        body: commentBody.slice(0, 80) || "sent a GIF",
        data: notifData,
      }),
      sendPushToUsers([creatorId], {
        title: `${senderName} commented on your prediction`,
        body: commentBody.slice(0, 80) || "sent a GIF",
        data: notifData,
      }),
    ]);
  }

  return NextResponse.json({ comment: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: betId } = await params;
  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  const [, { error }] = await Promise.all([
    supabase.from("notifications").delete().filter("data->>comment_id", "eq", commentId),
    supabase.from("bet_comments").delete().eq("id", commentId).eq("bet_id", betId).eq("user_id", user.userId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
