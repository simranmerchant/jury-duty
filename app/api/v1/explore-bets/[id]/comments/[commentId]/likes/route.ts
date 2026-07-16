import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/explore-bets/[id]/comments/[commentId]/likes — toggle like
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const { data: existing } = await supabase
    .from("explore_bet_comment_likes")
    .select("user_id")
    .eq("explore_bet_comment_id", commentId)
    .eq("user_id", user.userId)
    .single();

  if (existing) {
    await supabase
      .from("explore_bet_comment_likes")
      .delete()
      .eq("explore_bet_comment_id", commentId)
      .eq("user_id", user.userId);
  } else {
    await supabase
      .from("explore_bet_comment_likes")
      .insert({ explore_bet_comment_id: commentId, user_id: user.userId });
  }

  return NextResponse.json({ ok: true });
}
