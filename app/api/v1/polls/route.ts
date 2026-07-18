import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/polls — list explore polls (no event_id)
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: polls, error } = await supabase
    .from("polls")
    .select(`
      id, question, option_a, option_b, creator_id, created_at, closes_at,
      creator:creator_id(display_name, username, avatar_url),
      poll_votes(user_id, side),
      poll_likes(user_id),
      poll_reactions(user_id, emoji),
      poll_comments(id),
      poll_posts(user_id, caption, photo_url, created_at, user:user_id(display_name, username, avatar_url))
    `)
    .is("event_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (polls ?? []).map((poll) => {
    const rawVotes = (poll.poll_votes ?? []) as Array<{ user_id: string; side: string }>;
    // Deduplicate by user_id (last write wins) to guard against pre-constraint duplicates.
    const voteByUser = new Map<string, string>();
    for (const v of rawVotes) voteByUser.set(v.user_id, v.side);
    const votes_a = [...voteByUser.values()].filter((s) => s === "a").length;
    const votes_b = [...voteByUser.values()].filter((s) => s === "b").length;
    const myVote = (voteByUser.get(user.userId) ?? null) as "a" | "b" | null;

    const likes = (poll.poll_likes ?? []) as Array<{ user_id: string }>;
    const rawReactions = (poll.poll_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
    const reactionCounts: Record<string, number> = {};
    for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    const commentCount = (poll.poll_comments ?? []).length;

    const allPosts = (poll.poll_posts ?? []) as unknown as Array<{
      user_id: string; caption: string | null; photo_url: string | null; created_at: string;
      user: { display_name: string; username: string; avatar_url: string | null } | null;
    }>;
    const myPost = allPosts.find((p) => p.user_id === user.userId) ?? null;
    const publicPosts = allPosts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((p) => ({ user_id: p.user_id, caption: p.caption, photo_url: p.photo_url, created_at: p.created_at, user: p.user }));

    return {
      ...poll,
      poll_votes: undefined,
      poll_likes: undefined,
      poll_reactions: undefined,
      poll_comments: undefined,
      poll_posts: undefined,
      votes_a,
      votes_b,
      total_votes: votes_a + votes_b,
      my_vote: myVote,
      like_count: likes.length,
      liked_by_me: likes.some((l) => l.user_id === user.userId),
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
      my_reaction: rawReactions.find((r) => r.user_id === user.userId)?.emoji ?? null,
      comment_count: commentCount,
      is_mine: poll.creator_id === user.userId,
      my_post: myPost ? { caption: myPost.caption, photo_url: myPost.photo_url } : null,
      public_posts: publicPosts,
    };
  });

  return NextResponse.json({ polls: shaped });
}

// POST /api/v1/polls — create a new explore poll
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { question, option_a, option_b, closes_at } = body;

  if (!question?.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });
  if (question.trim().length > 200) return NextResponse.json({ error: "question too long" }, { status: 400 });
  if (!option_a?.trim()) return NextResponse.json({ error: "option_a required" }, { status: 400 });
  if (!option_b?.trim()) return NextResponse.json({ error: "option_b required" }, { status: 400 });
  if (option_a.trim().length > 80) return NextResponse.json({ error: "option_a too long" }, { status: 400 });
  if (option_b.trim().length > 80) return NextResponse.json({ error: "option_b too long" }, { status: 400 });
  if (closes_at && new Date(closes_at) <= new Date()) {
    return NextResponse.json({ error: "closes_at must be in the future" }, { status: 400 });
  }

  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      question: question.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      creator_id: user.userId,
      event_id: null,
      closes_at: closes_at ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pollId: poll.id }, { status: 201 });
}
