import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const supportsPollPost = req.headers.get("x-feed-capabilities")?.includes("poll-post") ?? false;

  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.userId)
    .eq("status", "accepted");

  const followedIds = (followRows ?? []).map((r) => r.following_id as string);
  const feedUserIds = [...new Set([user.userId, ...followedIds])];

  if (feedUserIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  // Query feed bets and posts in parallel, fetching extra so merged sort is accurate
  const betQuery = supabase
    .from("bets")
    .select(`
      id, question, deadline, status, winning_option_id, creator_id, created_at, audience,
      bet_options!bet_id(id, label, tagged_user_id,
        balances:tagged_user_id(display_name, avatar_url, username)
      ),
      bet_entries(user_id, option_id, points_staked, is_anonymous, balances:user_id(display_name, avatar_url, username)),
      balances:creator_id(display_name, avatar_url, username),
      bet_reactions(user_id, emoji),
      bet_comments!bet_id(id)
    `)
    .eq("audience", "followers")
    .in("creator_id", feedUserIds)
    .order("created_at", { ascending: false })
    .limit(25);

  const postQuery = supabase
    .from("posts")
    .select(`
      id, user_id, bet_id, caption, photo_url, targeted_user_ids, created_at,
      balances:user_id(display_name, avatar_url, username),
      post_likes(user_id),
      post_comments!post_id(id),
      bets:bet_id(
        id, question, deadline, status, winning_option_id, creator_id, created_at, event_id,
        bet_options!bet_id(id, label),
        bet_entries(user_id, option_id, points_staked, balances:user_id(display_name, avatar_url, username)),
        balances:creator_id(display_name, avatar_url, username),
        events:event_id(name)
      )
    `)
    .in("user_id", feedUserIds)
    .or(`targeted_user_ids.is.null,targeted_user_ids.cs.{${user.userId}}`)
    .order("created_at", { ascending: false })
    .limit(25);

  const pollPostQuery = supabase
    .from("poll_posts")
    .select(`
      id: poll_id, poll_id, user_id, caption, photo_url, targeted_user_ids, created_at,
      balances:user_id(display_name, avatar_url, username),
      polls:poll_id(id, question, option_a, option_b, creator_id, created_at, closes_at,
        poll_votes(user_id, side),
        poll_likes(user_id),
        poll_reactions(user_id, emoji),
        poll_comments(id)
      )
    `)
    .in("user_id", feedUserIds)
    .or(`targeted_user_ids.is.null,targeted_user_ids.cs.{${user.userId}}`)
    .order("created_at", { ascending: false })
    .limit(25);

  const applyCursor = (q: any) => cursor ? q.lt("created_at", cursor) : q;

  const [{ data: bets }, { data: posts }, { data: pollPosts }] = await Promise.all([
    applyCursor(betQuery),
    applyCursor(postQuery),
    supportsPollPost ? applyCursor(pollPostQuery) : Promise.resolve({ data: [] }),
  ]);

  // Suppress bare BetItem when a visible post already exists for that bet
  const sharedBetIds = new Set(
    (posts ?? [])
      .filter((p: any) => !p.targeted_user_ids || p.targeted_user_ids.includes(user.userId))
      .map((p: any) => p.bet_id as string)
  );

  const betItems = (bets ?? []).filter((b: any) => !sharedBetIds.has(b.id)).map((b: any) => {
    const rawReactions = (b.bet_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
    const reactionCounts: Record<string, number> = {};
    for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    const my_reaction = rawReactions.find((r) => r.user_id === user.userId)?.emoji ?? null;
    return {
      type: "bet" as const,
      ...b,
      bet_reactions: undefined,
      bet_comments: undefined,
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
      my_reaction,
      comment_count: (b.bet_comments ?? []).length,
    };
  });
  const postItems = (posts ?? []).map((p: any) => ({ type: "post" as const, ...p }));
  const pollPostItems = (pollPosts ?? []).map((pp: any) => {
    const poll = pp.polls as any;
    if (poll) {
      const votes = (poll.poll_votes ?? []) as Array<{ user_id: string; side: string }>;
      const votes_a = votes.filter((v: any) => v.side === "a").length;
      const votes_b = votes.filter((v: any) => v.side === "b").length;
      const my_vote = votes.find((v: any) => v.user_id === user.userId)?.side ?? null;
      const likes = (poll.poll_likes ?? []) as Array<{ user_id: string }>;
      const rawReactions = (poll.poll_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
      const reactionCounts: Record<string, number> = {};
      for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
      const my_reaction = rawReactions.find((r: any) => r.user_id === user.userId)?.emoji ?? null;
      pp.polls = {
        ...poll,
        poll_votes: undefined,
        poll_likes: undefined,
        poll_reactions: undefined,
        poll_comments: undefined,
        votes_a,
        votes_b,
        total_votes: votes_a + votes_b,
        my_vote,
        like_count: likes.length,
        reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
        my_reaction,
        comment_count: (poll.poll_comments ?? []).length,
      };
    }
    return { type: "poll_post" as const, ...pp };
  });

  const merged = [...betItems, ...postItems, ...pollPostItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const nextCursor = merged.length === 20 ? merged[merged.length - 1].created_at : null;

  return NextResponse.json({ items: merged, nextCursor, followedIds });
}
