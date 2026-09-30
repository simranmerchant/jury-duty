import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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

  const { id: betId } = await params;

  let message: string | undefined;
  try {
    const text = await req.text();
    if (text) {
      const parsed = JSON.parse(text);
      if (typeof parsed?.message === "string" && parsed.message.trim()) {
        message = parsed.message.trim().slice(0, 200);
      }
    }
  } catch {
    // body is optional
  }

  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, question, status, deadline, event_id")
    .eq("id", betId)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.creator_id === user.userId) return NextResponse.json({ error: "you can't nudge yourself — just resolve it!" }, { status: 403 });
  if (bet.status !== "open") return NextResponse.json({ error: "bet already resolved" }, { status: 422 });
  if (new Date(bet.deadline) > new Date()) return NextResponse.json({ error: "deadline hasn't passed yet" }, { status: 422 });

  // Rate limit: one nudge per user per bet per 24h
  const { data: recentNudge } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", bet.creator_id)
    .eq("type", "nudge_resolve")
    .contains("data", { bet_id: betId, sender_id: user.userId })
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (recentNudge) return NextResponse.json({ error: "already nudged in the last 24 hours" }, { status: 429 });

  const { data: nudger } = await supabase
    .from("balances")
    .select("display_name, username")
    .eq("user_id", user.userId)
    .single();

  const nudgerName = nudger?.display_name ?? nudger?.username ?? "someone";
  const title = "hey, time to resolve! 🏛️";
  const body = message
    ? `${nudgerName}: ${message}`
    : `${nudgerName} is waiting. resolve the bet.`;
  const notifData: Record<string, string> = { bet_id: betId, sender_id: user.userId };
  if (bet.event_id) notifData.event_id = bet.event_id;
  if (nudger?.username) notifData.sender_username = nudger.username;

  await Promise.all([
    supabase.from("notifications").insert({
      user_id: bet.creator_id,
      type: "nudge_resolve",
      title,
      body,
      data: notifData,
    }),
    sendPushToUsers([bet.creator_id], { title, body, data: notifData }),
  ]);

  return NextResponse.json({ ok: true });
}
