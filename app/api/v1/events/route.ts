import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { generateInviteToken } from "@/lib/invite";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, ends_at } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!ends_at) return NextResponse.json({ error: "ends_at required" }, { status: 400 });

  // Create event (invite_token placeholder — update after we have the id)
  const { data: event, error } = await supabase
    .from("events")
    .insert({ name: name.trim(), ends_at, host_id: user.userId, invite_token: "pending" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const invite_token = generateInviteToken(event.id);

  await supabase.from("events").update({ invite_token }).eq("id", event.id);

  // Add host as first guest
  await supabase.from("event_guests").insert({ event_id: event.id, user_id: user.userId });

  return NextResponse.json({ eventId: event.id, invite_token });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id, name, ends_at, host_id, invite_token,
      event_guests!inner(user_id),
      bets(id, status, visibility)
    `)
    .eq("event_guests.user_id", user.userId)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events });
}
