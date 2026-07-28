import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/users/[username]/following — param is user_id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username: targetId } = await params;

  const { data, error } = await supabase
    .from("follows")
    .select("following_id, created_at, balances!follows_following_id_fkey(display_name, username, avatar_url)")
    .eq("follower_id", targetId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const followingIds = (data ?? []).map((r: any) => r.following_id);

  // Check which of these users the authenticated user already follows
  const { data: myFollows } = followingIds.length > 0
    ? await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.userId)
        .eq("status", "accepted")
        .in("following_id", followingIds)
    : { data: [] };

  const followingSet = new Set((myFollows ?? []).map((r: any) => r.following_id));

  const following = (data ?? []).map((r: any) => ({
    user_id: r.following_id,
    display_name: r.balances?.display_name ?? null,
    username: r.balances?.username ?? null,
    avatar_url: r.balances?.avatar_url ?? null,
    is_followed_by_me: followingSet.has(r.following_id),
  }));

  return NextResponse.json({ following });
}
