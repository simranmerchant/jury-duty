import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/polls/[id] — full poll detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: poll, error } = await supabase
    .from("polls")
    .select(`
      id, question, option_a, option_b, creator_id, created_at, closes_at, event_id,
      creator:creator_id(display_name, username, avatar_url),
      poll_votes(user_id, side),
      poll_likes(user_id),
      poll_reactions(user_id, emoji),
      poll_comments(id, body, gif_url, parent_id, created_at, user_id, user:user_id(display_name, username, avatar_url), poll_comment_likes(user_id)),
      poll_posts(poll_id, user_id, caption, created_at)
    `)
    .eq("id", id)
    .single();

  if (error || !poll) return NextResponse.json({ error: "not found" }, { status: 404 });

  const votes = (poll.poll_votes ?? []) as Array<{ user_id: string; side: string }>;
  const votes_a = votes.filter((v) => v.side === "a").length;
  const votes_b = votes.filter((v) => v.side === "b").length;
  const myVote = votes.find((v) => v.user_id === user.userId)?.side ?? null;

  const likes = (poll.poll_likes ?? []) as Array<{ user_id: string }>;
  const likedByMe = likes.some((l) => l.user_id === user.userId);

  const rawReactions = (poll.poll_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
  const reactionCounts: Record<string, number> = {};
  for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
  const myReaction = rawReactions.find((r) => r.user_id === user.userId)?.emoji ?? null;

  const rawComments = (poll.poll_comments ?? []) as unknown as Array<{
    id: string; body: string | null; gif_url: string | null; parent_id: string | null;
    created_at: string; user_id: string;
    user: { display_name: string; username: string; avatar_url: string | null } | null;
    poll_comment_likes: { user_id: string }[];
  }>;
  const comments = rawComments
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((c) => ({
      id: c.id,
      body: c.body,
      gif_url: c.gif_url,
      parent_id: c.parent_id,
      created_at: c.created_at,
      user_id: c.user_id,
      is_mine: c.user_id === user.userId,
      user: c.user ?? null,
      comment_likes: c.poll_comment_likes ?? [],
    }));

  const allPosts = (poll.poll_posts ?? []) as unknown as Array<{
    poll_id: string; user_id: string; caption: string | null; created_at: string;
  }>;
  const myPost = allPosts.find((p) => p.user_id === user.userId) ?? null;

  return NextResponse.json({
    poll: {
      ...poll,
      poll_votes: undefined,
      poll_likes: undefined,
      poll_reactions: undefined,
      poll_comments: undefined,
      poll_posts: undefined,
      is_mine: poll.creator_id === user.userId,
      votes_a,
      votes_b,
      total_votes: votes_a + votes_b,
      my_vote: myVote,
      like_count: likes.length,
      liked_by_me: likedByMe,
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
      my_reaction: myReaction,
      comment_count: comments.length,
      comments,
      my_post: myPost ? { caption: myPost.caption } : null,
    },
  });
}

// DELETE /api/v1/polls/[id] — creator deletes poll
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: poll } = await supabase
    .from("polls")
    .select("creator_id")
    .eq("id", id)
    .single();

  if (!poll) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (poll.creator_id !== user.userId) return NextResponse.json({ error: "only the creator can delete this" }, { status: 403 });

  await supabase.from("notifications").delete().contains("data", { poll_id: id });

  const { error } = await supabase.from("polls").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
