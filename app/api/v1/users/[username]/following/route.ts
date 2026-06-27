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

  const following = (data ?? []).map((r: any) => ({
    user_id: r.following_id,
    display_name: r.balances?.display_name ?? null,
    username: r.balances?.username ?? null,
    avatar_url: r.balances?.avatar_url ?? null,
  }));

  return NextResponse.json({ following });
}
