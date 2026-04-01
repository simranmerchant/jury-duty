import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (event.host_id !== user.userId) return NextResponse.json({ error: "only the host can delete this event" }, { status: 403 });

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify the requesting user is the host or a guest of this event
  const { data: eventMeta, error: metaError } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", id)
    .single();

  if (metaError || !eventMeta) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isHost = eventMeta.host_id === user.userId;

  if (!isHost) {
    const { data: guest } = await supabase
      .from("event_guests")
      .select("user_id")
      .eq("event_id", id)
      .eq("user_id", user.userId)
      .single();

    if (!guest) return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Backfill: ensure host is always in event_guests (idempotent)
  if (isHost) {
    await supabase
      .from("event_guests")
      .upsert({ event_id: id, user_id: user.userId }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  }

  const { data: event, error } = await supabase
    .from("events")
    .select(`
      id, name, ends_at, host_id, invite_token,
      event_guests(user_id),
      bets(
        id, question, deadline, visibility, status, winning_option_id, creator_id, created_at,
        bet_options!bet_options_bet_id_fkey(id, label),
        bet_entries(id, user_id, option_id, points_staked, balances(display_name, avatar_url)),
        bet_invites(user_id)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !event) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Filter private bets — only show to creator or invited users
  const filteredBets = event.bets?.filter((bet: any) => {
    if (bet.visibility !== "private") return true;
    if (bet.creator_id === user.userId) return true;
    return bet.bet_invites?.some((inv: any) => inv.user_id === user.userId);
  });

  return NextResponse.json({ event: { ...event, bets: filteredBets }, userId: user.userId });
}
