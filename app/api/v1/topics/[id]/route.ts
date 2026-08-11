import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { computeExplorePayout } from "@/lib/explore-payout";
import { isTopicEditable } from "@/lib/topics";

// DELETE /api/v1/topics/[id] — creator deletes topic; refunds open bets, then deletes all bets in topic
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: topic } = await supabase
    .from("topics")
    .select("creator_id")
    .eq("id", id)
    .single();

  if (!topic) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isTopicEditable(topic.creator_id, user.userId)) {
    return NextResponse.json({ error: "only the creator can delete this topic" }, { status: 403 });
  }

  // Fetch all open explore_bets in this topic to refund entries
  const { data: openBets } = await supabase
    .from("explore_bets")
    .select("id")
    .eq("topic_id", id)
    .eq("status", "open");

  if (openBets && openBets.length > 0) {
    const betIds = openBets.map((b) => b.id);
    const { data: entries } = await supabase
      .from("explore_bet_entries")
      .select("user_id, side, points_wagered")
      .in("explore_bet_id", betIds);

    const allEntries = (entries ?? []) as Array<{ user_id: string; side: "a" | "b"; points_wagered: number }>;
    if (allEntries.length > 0) {
      const refunds = computeExplorePayout(allEntries, null);
      await Promise.all(
        Object.entries(refunds).map(([uid, pts]) =>
          supabase.rpc("increment_balance", { p_user_id: uid, p_amount: pts })
        )
      );
    }
  }

  // Delete all explore_bets in this topic (cascade will clean up entries, posts, etc.)
  await supabase.from("explore_bets").delete().eq("topic_id", id);

  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
