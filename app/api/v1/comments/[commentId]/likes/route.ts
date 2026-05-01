import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const { data: existing } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", user.userId)
    .single();

  if (existing) {
    await supabase.from("comment_likes").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, action: "unliked" });
  }

  await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.userId });
  return NextResponse.json({ ok: true, action: "liked" });
}
