import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/explore-bets — paginated list with aggregates + top public posts
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: bets, error }, { data: followRows }] = await Promise.all([
    supabase
      .from("explore_bets")
      .select(`
        id, question, option_a, option_b, status, winning_side, closes_at, created_at, creator_id,
        creator:creator_id(display_name, username, avatar_url),
        explore_bet_entries(user_id, side, points_wagered, bettor:user_id(display_name, username, avatar_url)),
        explore_bet_posts(
          id, caption, photo_url, created_at,
          user:user_id(user_id, display_name, username, avatar_url, is_private)
        ),
        explore_bet_likes(user_id),
        explore_bet_reactions(user_id, emoji),
        explore_bet_comments(id)
      `)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.userId)
      .eq("status", "accepted"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const followingIds = new Set((followRows ?? []).map((f: any) => f.following_id));

  const shaped = (bets ?? []).map((bet) => {
    const entries = (bet.explore_bet_entries ?? []) as Array<{ user_id: string; side: string; points_wagered: number; bettor: { display_name: string; username: string; avatar_url: string | null } | null }>;
    const totalA = entries.filter((e) => e.side === "a").reduce((s, e) => s + e.points_wagered, 0);
    const totalB = entries.filter((e) => e.side === "b").reduce((s, e) => s + e.points_wagered, 0);
    const myEntry = entries.find((e) => e.user_id === user.userId) ?? null;

    // Only show posts from public accounts on the card
    const allPosts = (bet.explore_bet_posts ?? []) as unknown as Array<{
      id: string; caption: string | null; photo_url: string | null; created_at: string;
      user: { user_id: string; display_name: string; username: string; avatar_url: string | null; is_private: boolean } | null;
    }>;
    const publicPosts = allPosts
      .filter((p) => p.user && !p.user.is_private)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    const myPost = allPosts.find((p) => p.user?.user_id === user.userId) ?? null;

    const likes = (bet.explore_bet_likes ?? []) as Array<{ user_id: string }>;
    const rawReactions = (bet.explore_bet_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
    const reactionCounts: Record<string, number> = {};
    for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    const commentCount = (bet.explore_bet_comments ?? []).length;

    return {
      ...bet,
      explore_bet_entries: undefined,
      explore_bet_posts: undefined,
      explore_bet_likes: undefined,
      explore_bet_reactions: undefined,
      explore_bet_comments: undefined,
      total_pts_a: totalA,
      total_pts_b: totalB,
      total_entries: entries.length,
      like_count: likes.length,
      liked_by_me: likes.some((l) => l.user_id === user.userId),
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
      my_reaction: rawReactions.find((r) => r.user_id === user.userId)?.emoji ?? null,
      comment_count: commentCount,
      my_entry: myEntry ? { side: myEntry.side as "a" | "b", points_wagered: myEntry.points_wagered } : null,
      followed_entries: entries
        .filter((e) => e.user_id !== user.userId && followingIds.has(e.user_id))
        .map((e) => ({ user_id: e.user_id, side: e.side as "a" | "b", bettor: e.bettor })),
      other_entry_count: entries.filter((e) => e.user_id !== user.userId && !followingIds.has(e.user_id)).length,
      is_mine: (bet as any).creator_id === user.userId,
      my_post: myPost ? { id: myPost.id, caption: myPost.caption, photo_url: myPost.photo_url } : null,
      public_posts: publicPosts.map((p) => ({
        id: p.id,
        caption: p.caption,
        photo_url: p.photo_url,
        created_at: p.created_at,
        user: p.user ? {
          user_id: p.user.user_id,
          display_name: p.user.display_name,
          username: p.user.username,
          avatar_url: p.user.avatar_url,
        } : null,
        side: entries.find((e) => p.user && e.user_id === p.user.user_id)?.side ?? null,
      })),
    };
  });

  return NextResponse.json({ bets: shaped });
}

// POST /api/v1/explore-bets — create a new explore bet
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

  const { data: bet, error } = await supabase
    .from("explore_bets")
    .insert({
      question: question.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      creator_id: user.userId,
      closes_at: closes_at ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: bet.id }, { status: 201 });
}
