import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/bets/[id]/like — toggle like
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("bet_likes")
    .select("user_id")
    .eq("bet_id", id)
    .eq("user_id", user.userId)
    .single();

  if (existing) {
    await supabase.from("bet_likes").delete().eq("bet_id", id).eq("user_id", user.userId);
  } else {
    await supabase.from("bet_likes").insert({ bet_id: id, user_id: user.userId });
  }

  const { count } = await supabase
    .from("bet_likes")
    .select("*", { count: "exact", head: true })
    .eq("bet_id", id);

  return NextResponse.json({ liked: !existing, like_count: count ?? 0 });
}
