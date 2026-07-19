import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: post }, { data: followRows }] = await Promise.all([
    supabase
      .from("explore_bet_posts")
      .select(`
        id, explore_bet_id, user_id, caption, photo_url, created_at,
        balances:user_id(display_name, avatar_url, username),
        explore_bets:explore_bet_id(
          id, question, option_a, option_b, status, winning_side, closes_at,
          explore_bet_entries(user_id, side, points_wagered, bettor:user_id(display_name, username, avatar_url)),
          explore_bet_reactions(user_id, emoji),
          explore_bet_comments(id)
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.userId)
      .eq("status", "accepted"),
  ]);

  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  const followedSet = new Set((followRows ?? []).map((f: any) => f.following_id as string));
  const bet = post.explore_bets as any;
  const entries = (bet?.explore_bet_entries ?? []) as unknown as Array<{ user_id: string; side: string; points_wagered: number; bettor: { display_name: string; username: string; avatar_url: string | null } | null }>;
  const totalA = entries.filter((e) => e.side === "a").reduce((s, e) => s + e.points_wagered, 0);
  const totalB = entries.filter((e) => e.side === "b").reduce((s, e) => s + e.points_wagered, 0);
  const myEntry = entries.find((e) => e.user_id === user.userId) ?? null;
  const rawReactions = (bet?.explore_bet_reactions ?? []) as Array<{ user_id: string; emoji: string }>;
  const reactionCounts: Record<string, number> = {};
  for (const r of rawReactions) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;

  const shaped = {
    type: "explore_bet_post" as const,
    id: post.id,
    explore_bet_id: post.explore_bet_id,
    user_id: post.user_id,
    caption: post.caption,
    photo_url: post.photo_url,
    created_at: post.created_at,
    balances: post.balances,
    explore_bets: bet ? {
      id: bet.id, question: bet.question, option_a: bet.option_a, option_b: bet.option_b,
      status: bet.status, winning_side: bet.winning_side, closes_at: bet.closes_at,
      total_pts_a: totalA, total_pts_b: totalB, total_entries: entries.length,
      my_entry: myEntry ? { side: myEntry.side as "a" | "b", points_wagered: myEntry.points_wagered } : null,
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
      my_reaction: rawReactions.find((r) => r.user_id === user.userId)?.emoji ?? null,
      comment_count: (bet.explore_bet_comments ?? []).length,
      followed_entries: entries
        .filter((e) => e.user_id !== user.userId && followedSet.has(e.user_id))
        .map((e) => ({ user_id: e.user_id, side: e.side as "a" | "b", bettor: e.bettor })),
      other_entry_count: entries.filter((e) => e.user_id !== user.userId && !followedSet.has(e.user_id)).length,
    } : null,
  };

  return NextResponse.json({ post: shaped });
}
