import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { generateInviteToken } from "@/lib/invite";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, ends_at, type = "event" } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.trim().length > 100) return NextResponse.json({ error: "name must be 100 chars or fewer" }, { status: 400 });
  if (!["event", "group"].includes(type)) return NextResponse.json({ error: "invalid type" }, { status: 400 });
  if (type === "event" && !ends_at) return NextResponse.json({ error: "ends_at required for events" }, { status: 400 });
  if (type === "event" && ends_at && new Date(ends_at) <= new Date()) return NextResponse.json({ error: "end date must be in the future" }, { status: 400 });

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name: name.trim(),
      ends_at: type === "group" ? null : ends_at,
      type,
      host_id: user.userId,
      invite_token: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const invite_token = generateInviteToken(event.id);
  await supabase.from("events").update({ invite_token }).eq("id", event.id);
  await supabase.from("event_guests").insert({ event_id: event.id, user_id: user.userId });

  await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: 200 });
  await supabase.from("notifications").insert({
    user_id: user.userId,
    type: "points_earned",
    title: "+200 pts",
    body: `you earned 200 points for creating "${name.trim()}". keep it up.`,
    data: { event_id: event.id },
  });

  return NextResponse.json({ eventId: event.id, invite_token });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: events, error }, { data: lastSeenRows }] = await Promise.all([
    supabase
      .from("events")
      .select(`
        id, name, ends_at, type, host_id, invite_token, cover_url,
        event_guests!inner(user_id),
        bets(id, status, visibility, creator_id, created_at)
      `)
      .eq("event_guests.user_id", user.userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_last_seen")
      .select("event_id, seen_at")
      .eq("user_id", user.userId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seenMap = new Map((lastSeenRows ?? []).map((r) => [r.event_id, r.seen_at]));

  const eventsWithNew = (events ?? []).map((event) => {
    // Only count bets the user can actually see (public, or private where they're creator/invited)
    const visibleBets = (event.bets ?? []).filter((b: any) =>
      b.visibility !== "private" || b.creator_id === user.userId
    );
    const seenAt = seenMap.get(event.id);
    const hasNew = visibleBets.some(
      (b: any) => b.creator_id !== user.userId && (!seenAt || new Date(b.created_at) > new Date(seenAt))
    );
    return { ...event, bets: visibleBets, hasNew };
  });

  return NextResponse.json({ events: eventsWithNew });
}
