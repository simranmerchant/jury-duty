import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

const ALLOWED = ["🔥", "👀", "💀", "😂", "🤝", "🫡"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: betId } = await params;
  const { emoji } = await req.json();
  if (!ALLOWED.includes(emoji)) return NextResponse.json({ error: "invalid emoji" }, { status: 400 });

  // Toggle: if same emoji exists, remove it; if different, upsert
  const { data: existing } = await supabase
    .from("bet_reactions")
    .select("id, emoji")
    .eq("bet_id", betId)
    .eq("user_id", user.userId)
    .single();

  if (existing && existing.emoji === emoji) {
    await supabase.from("bet_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, action: "removed" });
  }

  await supabase.from("bet_reactions").upsert(
    { bet_id: betId, user_id: user.userId, emoji },
    { onConflict: "bet_id,user_id" }
  );

  // Notify bet creator (skip if reacting to own bet)
  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, question")
    .eq("id", betId)
    .single();

  if (bet && bet.creator_id !== user.userId) {
    const { data: reactor } = await supabase
      .from("balances")
      .select("display_name, username")
      .eq("user_id", user.userId)
      .single();
    const reactorName = reactor?.display_name ?? reactor?.username ?? "someone";
    const preview = bet.question.slice(0, 60);

    await Promise.all([
      supabase.from("notifications").insert({
        user_id: bet.creator_id,
        type: "bet_reaction",
        title: `${reactorName} reacted ${emoji}`,
        body: preview,
        data: { bet_id: betId },
      }),
      sendPushToUsers([bet.creator_id], {
        title: `${reactorName} reacted ${emoji} to your bet`,
        body: preview,
        data: { bet_id: betId },
      }),
    ]);
  }

  return NextResponse.json({ ok: true, action: "added" });
}
