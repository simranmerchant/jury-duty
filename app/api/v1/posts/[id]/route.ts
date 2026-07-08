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

  const { data: post, error } = await supabase
    .from("posts")
    .select(`
      id, user_id, bet_id, caption, photo_url, created_at,
      balances:user_id(display_name, avatar_url, username),
      post_likes(user_id),
      post_comments!post_id(id),
      bets:bet_id(
        id, question, deadline, status, winning_option_id, creator_id, created_at, event_id,
        bet_options!bet_id(id, label),
        bet_entries(user_id, option_id, points_staked, balances:user_id(display_name, avatar_url, username)),
        balances:creator_id(display_name, avatar_url, username),
        events:event_id(name)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !post) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ post });
}
