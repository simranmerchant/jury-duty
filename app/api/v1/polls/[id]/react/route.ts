import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/polls/[id]/react — toggle an emoji reaction (same emoji = remove)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { emoji } = body;
  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("poll_reactions")
    .select("emoji")
    .eq("poll_id", id)
    .eq("user_id", user.userId)
    .maybeSingle();

  if (existing?.emoji === emoji) {
    await supabase.from("poll_reactions").delete().eq("poll_id", id).eq("user_id", user.userId);
  } else {
    await supabase
      .from("poll_reactions")
      .upsert({ poll_id: id, user_id: user.userId, emoji }, { onConflict: "poll_id,user_id" });
  }

  const { data: allReactions } = await supabase.from("poll_reactions").select("user_id, emoji").eq("poll_id", id);
  const reactionCounts: Record<string, number> = {};
  for (const r of allReactions ?? []) reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
  const reactions = Object.entries(reactionCounts).map(([e, count]) => ({ emoji: e, count }));
  const my_reaction = (allReactions ?? []).find((r) => r.user_id === user.userId)?.emoji ?? null;

  return NextResponse.json({ reactions, my_reaction });
}
