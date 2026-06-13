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

  // Get followed user IDs (accepted follows only)
  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.userId)
    .eq("status", "accepted");

  const followedIds = (followRows ?? []).map((r) => r.following_id as string);

  // Include own posts in feed
  const feedUserIds = [...new Set([user.userId, ...followedIds])];

  if (feedUserIds.length === 0) {
    return NextResponse.json({ bets: [], nextCursor: null });
  }

  let query = supabase
    .from("bets")
    .select(`
      id, question, deadline, status, winning_option_id, creator_id, created_at, audience, walrus_blob_id,
      bet_options!bet_id(id, label, tagged_user_id,
        balances:tagged_user_id(display_name, avatar_url, username)
      ),
      bet_entries(user_id, option_id, points_staked, is_anonymous),
      balances:creator_id(display_name, avatar_url, username)
    `)
    .eq("audience", "followers")
    .in("creator_id", feedUserIds)
    .order("created_at", { ascending: false })
    .limit(20);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: bets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = bets ?? [];
  const nextCursor = list.length === 20 ? list[list.length - 1].created_at : null;

  return NextResponse.json({ bets: list, nextCursor });
}
