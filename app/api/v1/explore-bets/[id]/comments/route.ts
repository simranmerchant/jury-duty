import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

// GET /api/v1/explore-bets/[id]/comments — list comments oldest-first
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: raw, error } = await supabase
    .from("explore_bet_comments")
    .select(`id, body, gif_url, parent_id, created_at, user_id, user:user_id(display_name, username, avatar_url), explore_bet_comment_likes(user_id)`)
    .eq("explore_bet_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comments = (raw ?? []).map((c: any) => ({
    id: c.id,
    body: c.body,
    gif_url: c.gif_url ?? null,
    parent_id: c.parent_id ?? null,
    created_at: c.created_at,
    user_id: c.user_id,
    is_mine: c.user_id === user.userId,
    user: c.user ?? null,
    comment_likes: (c.explore_bet_comment_likes ?? []) as { user_id: string }[],
  }));

  return NextResponse.json({ comments });
}

// POST /api/v1/explore-bets/[id]/comments — add a comment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { text, gif_url, parent_id } = body;

  if (!text?.trim() && !gif_url) return NextResponse.json({ error: "comment cannot be empty" }, { status: 400 });
  if (text?.trim().length > 500) return NextResponse.json({ error: "comment too long" }, { status: 400 });

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id, question, creator_id")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: comment, error } = await supabase
    .from("explore_bet_comments")
    .insert({
      explore_bet_id: id,
      user_id: user.userId,
      body: text?.trim() || null,
      gif_url: gif_url ?? null,
      parent_id: parent_id ?? null,
    })
    .select(`id, body, gif_url, parent_id, created_at, user_id, user:user_id(display_name, username, avatar_url)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const commenterName = (comment as any).user?.display_name ?? "someone";
  const commentBody = text?.trim() ? `${commenterName}: ${text.trim().slice(0, 80)}` : `${commenterName} left a GIF`;

  if (parent_id) {
    // Reply: notify the parent comment author
    const { data: parentComment } = await supabase.from("explore_bet_comments").select("user_id").eq("id", parent_id).single();
    if (parentComment && parentComment.user_id !== user.userId) {
      await Promise.all([
        supabase.from("notifications").insert({ user_id: parentComment.user_id, type: "comment_reply", title: `${commenterName} replied to you`, body: commentBody, data: { explore_bet_id: id } }),
        sendPushToUsers([parentComment.user_id], { title: `${commenterName} replied to you`, body: commentBody, data: { explore_bet_id: id } }),
      ]);
    }
  } else if (bet.creator_id && bet.creator_id !== user.userId) {
    await Promise.all([
      supabase.from("notifications").insert({ user_id: bet.creator_id, type: "explore_bet_comment", title: `comment on "${bet.question}"`, body: commentBody, data: { explore_bet_id: id } }),
      sendPushToUsers([bet.creator_id], { title: `comment on "${bet.question}"`, body: commentBody, data: { explore_bet_id: id } }),
    ]);
  }

  return NextResponse.json({
    comment: {
      ...(comment as any),
      is_mine: true,
      comment_likes: [],
    },
  }, { status: 201 });
}
