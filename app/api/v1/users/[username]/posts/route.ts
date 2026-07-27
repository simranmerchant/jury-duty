import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/users/[username]/posts — public posts grid for a user profile
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

  const { data: posts, error } = await supabase
    .from("posts")
    .select(`
      id, caption, photo_url, created_at, bet_id,
      post_likes(user_id),
      post_comments!post_id(id),
      bets:bet_id(question, status, winning_option_id,
        bet_options!bet_id(id, label),
        bet_entries(user_id, option_id)
      )
    `)
    .eq("user_id", targetId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (posts ?? []).map((p: any) => ({
    id: p.id,
    caption: p.caption ?? null,
    photo_url: p.photo_url ?? null,
    created_at: p.created_at,
    bet_id: p.bet_id,
    like_count: (p.post_likes ?? []).length,
    liked_by_me: (p.post_likes ?? []).some((l: any) => l.user_id === user.userId),
    comment_count: (p.post_comments ?? []).length,
    bet: p.bets
      ? {
          question: p.bets.question,
          status: p.bets.status,
          options: p.bets.bet_options ?? [],
        }
      : null,
  }));

  return NextResponse.json({ posts: shaped });
}
