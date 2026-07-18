import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

const ALLOWED_EMOJIS = ["🔥", "🎯", "💀", "😂", "👀", "🤔"];

// POST /api/v1/explore-bets/[id]/react — set or toggle reaction
// body: { emoji } — send same emoji to remove it, different emoji to switch
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

  const { data: existing } = await supabase
    .from("explore_bet_reactions")
    .select("emoji")
    .eq("explore_bet_id", id)
    .eq("user_id", user.userId)
    .single();

  if (existing?.emoji === emoji) {
    // Same emoji — remove reaction
    await supabase
      .from("explore_bet_reactions")
      .delete()
      .eq("explore_bet_id", id)
      .eq("user_id", user.userId);
  } else {
    // New or different emoji — upsert
    await supabase
      .from("explore_bet_reactions")
      .upsert(
        { explore_bet_id: id, user_id: user.userId, emoji },
        { onConflict: "explore_bet_id,user_id" }
      );
  }

  const { data: allReactions } = await supabase
    .from("explore_bet_reactions")
    .select("emoji")
    .eq("explore_bet_id", id);

  const counts: Record<string, number> = {};
  for (const r of allReactions ?? []) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  }

  return NextResponse.json({
    my_reaction: existing?.emoji === emoji ? null : emoji,
    reactions: Object.entries(counts).map(([e, c]) => ({ emoji: e, count: c })),
  });
}
