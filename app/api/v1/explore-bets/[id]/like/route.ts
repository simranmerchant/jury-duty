import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // Parallel: check existing like + fetch bet creator + current count
  const [{ data: existing }, { data: bet }, { count: currentCount }] = await Promise.all([
    supabase.from("explore_bet_likes").select("user_id").eq("explore_bet_id", id).eq("user_id", user.userId).maybeSingle(),
    supabase.from("explore_bets").select("creator_id, question").eq("id", id).single(),
    supabase.from("explore_bet_likes").select("*", { count: "exact", head: true }).eq("explore_bet_id", id),
  ]);

  if (existing) {
    await supabase.from("explore_bet_likes").delete().eq("explore_bet_id", id).eq("user_id", user.userId);
  } else {
    await supabase.from("explore_bet_likes").insert({ explore_bet_id: id, user_id: user.userId });
  }

  const liked = !existing;
  const like_count = (currentCount ?? 0) + (liked ? 1 : -1);

  if (liked && bet && bet.creator_id !== user.userId) {
    const { data: liker } = await supabase.from("balances").select("display_name").eq("user_id", user.userId).single();
    const likerName = liker?.display_name ?? "someone";
    const body = bet.question ? `${likerName} liked your bet: "${bet.question}"` : `${likerName} liked your bet`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: bet.creator_id, type: "explore_bet_like", title: "new like ❤️", body, data: { explore_bet_id: id } }),
      sendPushToUsers([bet.creator_id], { title: "new like ❤️", body, data: { explore_bet_id: id } }),
    ]);
  }

  return NextResponse.json({ liked, like_count });
}
