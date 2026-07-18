import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// DELETE /api/v1/explore-bets/[id]/comments/[commentId] — delete own comment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const { data: comment } = await supabase
    .from("explore_bet_comments")
    .select("user_id")
    .eq("id", commentId)
    .single();

  if (!comment) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (comment.user_id !== user.userId) {
    return NextResponse.json({ error: "not your comment" }, { status: 403 });
  }

  await supabase.from("explore_bet_comments").delete().eq("id", commentId);

  return NextResponse.json({ ok: true });
}
