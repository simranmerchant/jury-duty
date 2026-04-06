import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
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

  const { id: eventId } = await params;

  const { data: guest } = await supabase
    .from("event_guests")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", user.userId)
    .single();

  if (!guest) return NextResponse.json({ error: "not a guest of this event" }, { status: 403 });

  const { data: event } = await supabase
    .from("events")
    .select("ends_at, type, name")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });

  // Events have a hard close date; groups never close
  if (event.type === "event" && event.ends_at && new Date(event.ends_at) < new Date()) {
    return NextResponse.json({ error: "event is closed" }, { status: 422 });
  }

  const { question, options, visibility, invitedUserIds, deadline } = await req.json();

  if (!question?.trim() || question.trim().length > 200) {
    return NextResponse.json({ error: "question required (max 200 chars)" }, { status: 400 });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "at least 2 options required" }, { status: 400 });
  }
  // options can be string[] (legacy) or { label: string, tagged_user_id?: string }[]
  const normalizedOptions: { label: string; tagged_user_id?: string }[] = options.map((o: any) =>
    typeof o === "string" ? { label: o } : { label: o.label, tagged_user_id: o.tagged_user_id ?? undefined }
  );
  if (normalizedOptions.some((o) => !o.label?.trim() || o.label.trim().length > 100)) {
    return NextResponse.json({ error: "each option must be 1-100 chars" }, { status: 400 });
  }
  if (visibility && !["public", "private"].includes(visibility)) {
    return NextResponse.json({ error: "invalid visibility" }, { status: 400 });
  }

  // Groups use per-bet deadline; events inherit ends_at
  let betDeadline: string;
  if (event.type === "group") {
    if (!deadline) return NextResponse.json({ error: "deadline required for group bets" }, { status: 400 });
    if (new Date(deadline) <= new Date()) return NextResponse.json({ error: "deadline must be in the future" }, { status: 400 });
    betDeadline = deadline;
  } else {
    betDeadline = event.ends_at!;
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      event_id: eventId,
      creator_id: user.userId,
      question: question.trim(),
      deadline: betDeadline,
      visibility: visibility ?? "public",
    })
    .select("id")
    .single();

  if (betError || !bet) return NextResponse.json({ error: betError?.message ?? "failed" }, { status: 500 });

  const { error: optError } = await supabase
    .from("bet_options")
    .insert(normalizedOptions.map((o) => ({
      bet_id: bet.id,
      label: o.label.trim(),
      ...(o.tagged_user_id ? { tagged_user_id: o.tagged_user_id } : {}),
    })));

  if (optError) return NextResponse.json({ error: optError.message }, { status: 500 });

  // Get all other guests for notifications
  const { data: allGuests } = await supabase
    .from("event_guests")
    .select("user_id")
    .eq("event_id", eventId)
    .neq("user_id", user.userId);
  const otherGuestIds = (allGuests ?? []).map((g: any) => g.user_id as string);

  const { data: creatorData } = await supabase
    .from("balances")
    .select("display_name")
    .eq("user_id", user.userId)
    .single();
  const creatorName = creatorData?.display_name ?? "someone";

  // Also invite any tagged users from options automatically
  const taggedUserIds = normalizedOptions
    .filter((o) => o.tagged_user_id)
    .map((o) => o.tagged_user_id as string);

  if (visibility === "private") {
    const inviteIds = [...new Set([user.userId, ...(Array.isArray(invitedUserIds) ? invitedUserIds : []), ...taggedUserIds])];
    await supabase.from("bet_invites").insert(inviteIds.map((uid) => ({ bet_id: bet.id, user_id: uid })));

    const notifyIds = inviteIds.filter((uid) => uid !== user.userId);
    if (notifyIds.length > 0) {
      await supabase.from("notifications").insert(notifyIds.map((uid) => ({
        user_id: uid,
        type: "bet_invited",
        title: "you've been added to a private bet 👀",
        body: "open the app to see it",
        data: { bet_id: bet.id, event_id: eventId },
      })));
      await sendPushToUsers(notifyIds, {
        title: "you've been added to a private bet 👀",
        body: "open the app to see it",
        data: { event_id: eventId },
      });
    }
  } else if (otherGuestIds.length > 0) {
    await supabase.from("notifications").insert(otherGuestIds.map((uid) => ({
      user_id: uid,
      type: "new_bet",
      title: `new bet in ${event.name} 🗳️`,
      body: "open the app to vote",
      data: { bet_id: bet.id, event_id: eventId },
    })));
    await sendPushToUsers(otherGuestIds, {
      title: `new bet in ${event.name} 🗳️`,
      body: "open the app to vote",
      data: { event_id: eventId },
    });
  }

  await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: 100 });
  await supabase.from("notifications").insert({
    user_id: user.userId,
    type: "points_earned",
    title: "+100 pts",
    body: `you earned 100 points for creating a bet. keep the jury busy.`,
    data: { bet_id: bet.id },
  });

  return NextResponse.json({ betId: bet.id }, { status: 201 });
}
