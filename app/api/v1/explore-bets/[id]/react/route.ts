import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

const ALLOWED_EMOJIS = ["🔥", "🎯", "💀", "😂", "👀", "🤔"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { emoji } = body;

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "invalid emoji" }, { status: 400 });
  }

  // Parallel: check existing reaction + all reactions + bet creator
  const [{ data: existing }, { data: allReactions }, { data: bet }] = await Promise.all([
    supabase.from("explore_bet_reactions").select("emoji").eq("explore_bet_id", id).eq("user_id", user.userId).maybeSingle(),
    supabase.from("explore_bet_reactions").select("emoji").eq("explore_bet_id", id),
    supabase.from("explore_bets").select("creator_id, question").eq("id", id).single(),
  ]);

  const removing = existing?.emoji === emoji;

  if (removing) {
    await supabase.from("explore_bet_reactions").delete().eq("explore_bet_id", id).eq("user_id", user.userId);
  } else {
    await supabase.from("explore_bet_reactions").upsert(
      { explore_bet_id: id, user_id: user.userId, emoji },
      { onConflict: "explore_bet_id,user_id" }
    );
  }

  // Compute counts from pre-change data + delta (avoids a third DB round-trip)
  const counts: Record<string, number> = {};
  for (const r of allReactions ?? []) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  if (existing?.emoji) counts[existing.emoji] = Math.max(0, (counts[existing.emoji] ?? 0) - 1);
  if (!removing) counts[emoji] = (counts[emoji] ?? 0) + 1;

  if (!removing && bet && bet.creator_id !== user.userId) {
    const { data: reactor } = await supabase.from("balances").select("display_name").eq("user_id", user.userId).single();
    const reactorName = reactor?.display_name ?? "someone";
    const notifBody = bet.question
      ? `${reactorName} reacted ${emoji} to your bet: "${bet.question}"`
      : `${reactorName} reacted ${emoji} to your bet`;
    await Promise.all([
      supabase.from("notifications").insert({ user_id: bet.creator_id, type: "explore_bet_reaction", title: `${emoji} reaction`, body: notifBody, data: { explore_bet_id: id } }),
      sendPushToUsers([bet.creator_id], { title: `${emoji} reaction`, body: notifBody, data: { explore_bet_id: id } }),
    ]);
  }

  return NextResponse.json({
    my_reaction: removing ? null : emoji,
    reactions: Object.entries(counts).filter(([, c]) => c > 0).map(([e, c]) => ({ emoji: e, count: c })),
  });
}
