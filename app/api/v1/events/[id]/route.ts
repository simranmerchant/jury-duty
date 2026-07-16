import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function PATCH(
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
    .select("host_id, type")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (event.host_id !== user.userId) return NextResponse.json({ error: "only the host can edit this" }, { status: 403 });

  const { name, ends_at } = await req.json();
  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (ends_at && event.type === "event") updates.ends_at = ends_at;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { error } = await supabase.from("events").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

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
    .select("host_id, type")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (event.host_id !== user.userId) return NextResponse.json({ error: "only the host can delete this event" }, { status: 403 });

  // Refund all stakes from open bets before deleting so no one loses points
  const { data: openEntries } = await supabase
    .from("bet_entries")
    .select("user_id, points_staked, bets!inner(event_id, status)")
    .eq("bets.event_id", id)
    .eq("bets.status", "open");

  if (openEntries && openEntries.length > 0) {
    // Group stakes by user and refund
    const refunds: Record<string, number> = {};
    for (const entry of openEntries) {
      refunds[entry.user_id] = (refunds[entry.user_id] ?? 0) + entry.points_staked;
    }
    await Promise.all(
      Object.entries(refunds).map(([userId, pts]) =>
        supabase.rpc("increment_balance", { p_user_id: userId, p_amount: pts })
      )
    );
  }

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Claw back the creation reward from the host
  await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: -50 });

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

  const [{ data: event, error }, { data: lastSeen }] = await Promise.all([
    supabase
      .from("events")
      .select(`
        id, name, ends_at, type, host_id, invite_token, cover_url, cover_original_url,
        host_balance:balances!events_host_id_fkey(display_name, avatar_url, username),
        event_guests(user_id, balances(display_name, avatar_url, username)),
        bets(
          id, question, question_tagged_user_ids, deadline, visibility, status, winning_option_id, creator_id, created_at,
          bet_options!bet_options_bet_id_fkey(id, label, tagged_user_id, balances!bet_options_tagged_user_id_fkey(display_name, avatar_url, username)),
          bet_entries(id, user_id, option_id, points_staked, is_anonymous),
          bet_invites(user_id),
          bet_reactions(user_id, emoji),
          bet_likes(user_id),
          bet_comments!bet_comments_bet_id_fkey(id),
          posts!posts_bet_id_fkey(id, user_id, caption, photo_url, created_at, balances:user_id(display_name, avatar_url, username))
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("event_last_seen")
      .select("seen_at")
      .eq("user_id", user.userId)
      .eq("event_id", id)
      .single(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });

  const seenAt = lastSeen?.seen_at ?? null;

  // Filter private bets — only show to creator or invited users
  // Also tag each bet with isNew (created after last seen, and not by this user)
  const filteredBets = event.bets
    ?.filter((bet: any) => {
      if (bet.visibility !== "private") return true;
      if (bet.creator_id === user.userId) return true;
      return bet.bet_invites?.some((inv: any) => inv.user_id === user.userId);
    })
    .map((bet: any) => {
      const likes = (bet.bet_likes ?? []) as Array<{ user_id: string }>;
      return {
        ...bet,
        bet_likes: undefined,
        like_count: likes.length,
        liked_by_me: likes.some((l) => l.user_id === user.userId),
        isNew: bet.creator_id !== user.userId && (!seenAt || new Date(bet.created_at) > new Date(seenAt)),
      };
    });

  // Guarantee the host appears in event_guests so the mobile client can resolve
  // voter display names without a separate balances join on bet_entries.
  const { host_balance, ...eventFields } = event as any;
  const hostInGuests = event.event_guests.some((g: any) => g.user_id === event.host_id);
  const eventGuests = hostInGuests
    ? event.event_guests
    : [...event.event_guests, { user_id: event.host_id, balances: host_balance ?? null }];

  return NextResponse.json({
    event: { ...eventFields, event_guests: eventGuests, bets: filteredBets },
    userId: user.userId,
  });
}
