import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

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
      id, question, option_a, option_b, status, winning_side, closes_at, created_at,
      creator:creator_id(display_name, username, avatar_url),
      explore_bet_entries(user_id, side, points_wagered, created_at),
      explore_bet_posts(
        id, caption, created_at,
        user:user_id(user_id, display_name, username, avatar_url, is_private)
      )
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
