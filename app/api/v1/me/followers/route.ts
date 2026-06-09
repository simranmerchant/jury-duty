import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/me/followers — list accepted followers
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, created_at, balances!follows_follower_id_fkey(display_name, username, avatar_url)")
    .eq("following_id", user.userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const followers = (data ?? []).map((r: any) => ({
    user_id: r.follower_id,
    display_name: r.balances?.display_name ?? null,
    username: r.balances?.username ?? null,
    avatar_url: r.balances?.avatar_url ?? null,
    followed_at: r.created_at,
  }));

  return NextResponse.json({ followers });
}
