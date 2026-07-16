import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { computeExplorePayout } from "@/lib/explore-payout";

// GET /api/v1/explore-bets/[id] — full detail: all entries + all public posts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: bet, error } = await supabase
    .from("explore_bets")
    .select(`
      id, question, option_a, option_b, status, winning_side, closes_at, created_at, creator_id,
      creator:creator_id(display_name, username, avatar_url),
      explore_bet_entries(user_id, side, points_wagered, created_at),
      explore_bet_posts(
        id, caption, created_at,
        user:user_id(user_id, display_name, username, avatar_url, is_private)
      ),
      explore_bet_likes(user_id),
      explore_bet_reactions(user_id, emoji),
      explore_bet_comments(id, body, gif_url, parent_id, created_at, user_id, user:user_id(display_name, username, avatar_url), explore_bet_comment_likes(user_id))
    `)
    .eq("id", id)
    .single();

  if (error || !bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const entries = (bet.explore_bet_entries ?? []) as Array<{
    user_id: string; side: string; points_wagered: number; created_at: string;
  }>;
  const totalA = entries.filter((e) => e.side === "a").reduce((s, e) => s + e.points_wagered, 0);
  const totalB = entries.filter((e) => e.side === "b").reduce((s, e) => s + e.points_wagered, 0);
  const myEntry = entries.find((e) => e.user_id === user.userId) ?? null;

  // Likes
  const likes = (bet.explore_bet_likes ?? []) as Array<{ user_id: string }>;
  const likedByMe = likes.some((l) => l.user_id === user.userId);

  // Reactions
  const rawReactions = (bet.explore_bet_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
  const reactionCounts: Record<string, number> = {};
  for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
  const myReaction = rawReactions.find((r) => r.user_id === user.userId)?.emoji ?? null;

  // Comments
  const rawComments = (bet.explore_bet_comments ?? []) as unknown as Array<{
    id: string; body: string | null; gif_url: string | null; parent_id: string | null;
    created_at: string; user_id: string;
    user: { display_name: string; username: string; avatar_url: string | null } | null;
    explore_bet_comment_likes: { user_id: string }[];
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
      comment_likes: c.explore_bet_comment_likes ?? [],
    }));

  const allPosts = (bet.explore_bet_posts ?? []) as unknown as Array<{
    id: string; caption: string | null; created_at: string;
    user: { user_id: string; display_name: string; username: string; avatar_url: string | null; is_private: boolean } | null;
  }>;
  const publicPosts = allPosts
    .filter((p) => p.user && !p.user.is_private)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const myPost = allPosts.find((p) => p.user?.user_id === user.userId) ?? null;

  return NextResponse.json({
    bet: {
      ...bet,
      explore_bet_entries: undefined,
      explore_bet_posts: undefined,
      explore_bet_likes: undefined,
      explore_bet_reactions: undefined,
      explore_bet_comments: undefined,
      explore_bet_comment_likes: undefined,
      is_mine: bet.creator_id === user.userId,
      like_count: likes.length,
      liked_by_me: likedByMe,
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
      my_reaction: myReaction,
      comments,
      total_pts_a: totalA,
      total_pts_b: totalB,
      total_entries: entries.length,
      my_entry: myEntry ? { side: myEntry.side, points_wagered: myEntry.points_wagered } : null,
      my_post: myPost ? { id: myPost.id, caption: myPost.caption } : null,
      public_posts: publicPosts.map((p) => ({
        id: p.id,
        caption: p.caption,
        created_at: p.created_at,
        user: p.user ? {
          user_id: p.user.user_id,
          display_name: p.user.display_name,
          username: p.user.username,
          avatar_url: p.user.avatar_url,
        } : null,
        side: entries.find((e) => p.user && e.user_id === p.user.user_id)?.side ?? null,
      })),
    },
  });
}

// DELETE /api/v1/explore-bets/[id] — creator deletes bet; refunds open entries
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("creator_id, status")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.creator_id !== user.userId) return NextResponse.json({ error: "only the creator can delete this" }, { status: 403 });

  // Refund all entries if the bet hasn't been resolved yet
  if (bet.status === "open") {
    const { data: entries } = await supabase
      .from("explore_bet_entries")
      .select("user_id, side, points_wagered")
      .eq("explore_bet_id", id);

    const allEntries = (entries ?? []) as Array<{ user_id: string; side: "a" | "b"; points_wagered: number }>;
    if (allEntries.length > 0) {
      const refunds = computeExplorePayout(allEntries, null); // null = void/refund all
      await Promise.all(
        Object.entries(refunds).map(([uid, pts]) =>
          supabase.rpc("increment_balance", { p_user_id: uid, p_amount: pts })
        )
      );
    }
  }

  const { error } = await supabase.from("explore_bets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
