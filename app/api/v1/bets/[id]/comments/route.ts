import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

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
    .select("id, body, created_at, user_id, parent_id, balances(display_name, avatar_url, username), comment_likes(user_id)")
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
  const { body, parentId } = await req.json();

  if (!body?.trim()) return NextResponse.json({ error: "comment required" }, { status: 400 });
  if (body.trim().length > 500) return NextResponse.json({ error: "max 500 chars" }, { status: 400 });

  const insert: Record<string, unknown> = { bet_id: betId, user_id: user.userId, body: body.trim() };
  if (parentId) insert.parent_id = parentId;

  const { data, error } = await supabase
    .from("bet_comments")
    .insert(insert)
    .select("id, body, created_at, user_id, parent_id, balances(display_name, avatar_url, username), comment_likes(user_id)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch bet + sender profile for notifications (always needed now)
  const mentionedUsernames = [...body.trim().matchAll(/@(\w+)/g)].map((m) => m[1]);
  const [senderProfileRes, betRes, mentionedRes] = await Promise.all([
    supabase.from("balances").select("display_name, username").eq("user_id", user.userId).single(),
    supabase.from("bets").select("event_id, creator_id, question").eq("id", betId).single(),
    mentionedUsernames.length > 0
      ? supabase.from("balances").select("user_id, username").in("username", mentionedUsernames)
      : Promise.resolve({ data: [] }),
  ]);

  const senderName = senderProfileRes.data?.display_name ?? senderProfileRes.data?.username ?? "someone";
  const eventId = betRes.data?.event_id ?? null;
  const creatorId = betRes.data?.creator_id ?? null;
  const betQuestion = betRes.data?.question ?? "a prediction";
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
          body: body.trim().slice(0, 80),
          data: notifData,
        }))
      ),
      sendPushToUsers(mentionedIds, {
        title: `${senderName} mentioned you in a comment`,
        body: body.trim().slice(0, 80),
        data: notifData,
      }),
    ]);
  }

  // Notify bet creator when someone else comments (skip if creator is the commenter or already mentioned)
  if (creatorId && creatorId !== user.userId && !mentionedIds.includes(creatorId)) {
    await Promise.all([
      supabase.from("notifications").insert({
        user_id: creatorId,
        type: "comment_on_bet",
        title: `${senderName} commented on your prediction`,
        body: body.trim().slice(0, 80),
        data: notifData,
      }),
      sendPushToUsers([creatorId], {
        title: `${senderName} commented on your prediction`,
        body: body.trim().slice(0, 80),
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

  const { error } = await supabase
    .from("bet_comments")
    .delete()
    .eq("id", commentId)
    .eq("bet_id", betId)
    .eq("user_id", user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
