import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // created_at ISO string for pagination

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
      bet_entries(user_id, option_id, points_staked, is_anonymous),
      balances:creator_id(display_name, avatar_url, username)
    `)
    .eq("audience", "followers")
    .in("creator_id", feedUserIds)
    .order("created_at", { ascending: false })
    .limit(25);

  const postQuery = supabase
    .from("posts")
    .select(`
      id, user_id, bet_id, caption, created_at,
      balances:user_id(display_name, avatar_url, username),
      bets:bet_id(
        id, question, deadline, status, winning_option_id, creator_id, created_at,
        bet_options!bet_id(id, label),
        bet_entries(user_id, option_id, points_staked),
        balances:creator_id(display_name, avatar_url, username)
      )
    `)
    .in("user_id", feedUserIds)
    .order("created_at", { ascending: false })
    .limit(25);

  const applyCursor = (q: any) => cursor ? q.lt("created_at", cursor) : q;

  const [{ data: bets }, { data: posts }] = await Promise.all([
    applyCursor(betQuery),
    applyCursor(postQuery),
  ]);

  const betItems = (bets ?? []).map((b: any) => ({ type: "bet" as const, ...b }));
  const postItems = (posts ?? []).map((p: any) => ({ type: "post" as const, ...p }));

  const merged = [...betItems, ...postItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const nextCursor = merged.length === 20 ? merged[merged.length - 1].created_at : null;

  return NextResponse.json({ items: merged, nextCursor });
}
