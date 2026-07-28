import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/users/[username]/posts — all posts for a user's profile grid
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await params;
  const u = username?.toLowerCase().trim();

  const { data: balance } = await supabase
    .from("balances")
    .select("user_id, is_private")
    .eq("username", u)
    .single();

  if (!balance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const targetId = balance.user_id;

  // Private accounts: only show posts if viewer follows them (or it's themselves)
  if (balance.is_private && targetId !== user.userId) {
    const { data: follow } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", user.userId)
      .eq("following_id", targetId)
      .single();

    if (follow?.status !== "accepted") {
      return NextResponse.json({ posts: [] });
    }
  }

  const [
    { data: betPosts },
    { data: explorePosts },
    { data: pollPosts },
  ] = await Promise.all([
    // Regular feed bet posts
    supabase
      .from("posts")
      .select("id, caption, photo_url, created_at, bets:bet_id(question), post_likes(user_id), post_comments!post_id(id)")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(60),

    // Explore bet posts
    supabase
      .from("explore_bet_posts")
      .select("id, explore_bet_id, caption, photo_url, created_at, explore_bets:explore_bet_id(question, explore_bet_likes(user_id), explore_bet_comments(id))")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(60),

    // Poll posts
    supabase
      .from("poll_posts")
      .select("poll_id, caption, photo_url, created_at, polls:poll_id(question), poll_likes(user_id), poll_comments:poll_id(id)")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const shaped = [
    ...(betPosts ?? []).map((p: any) => ({
      id: p.id,
      type: "post" as const,
      photo_url: p.photo_url ?? null,
      bet_question: (p.bets as any)?.question ?? null,
      like_count: (p.post_likes ?? []).length,
      comment_count: (p.post_comments ?? []).length,
      created_at: p.created_at,
    })),
    ...(explorePosts ?? []).map((p: any) => ({
      id: p.explore_bet_id,
      type: "explore_bet_post" as const,
      photo_url: p.photo_url ?? null,
      bet_question: (p.explore_bets as any)?.question ?? null,
      like_count: ((p.explore_bets as any)?.explore_bet_likes ?? []).length,
      comment_count: ((p.explore_bets as any)?.explore_bet_comments ?? []).length,
      created_at: p.created_at,
    })),
    ...(pollPosts ?? []).map((p: any) => ({
      id: p.poll_id,
      type: "poll_post" as const,
      photo_url: p.photo_url ?? null,
      bet_question: (p.polls as any)?.question ?? null,
      like_count: (p.poll_likes ?? []).length,
      comment_count: (p.poll_comments ?? []).length,
      created_at: p.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
   .slice(0, 60);

  return NextResponse.json({ posts: shaped });
}
