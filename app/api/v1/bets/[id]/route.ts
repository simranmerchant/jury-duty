import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { calculateRefunds } from "@/lib/payout";
import { redactAnonymousBet, redactAnonymousEntries } from "@/lib/privacy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: bet } = await supabase
    .from("bets")
    .select(`
      id, question, deadline, status, winning_option_id, creator_id, created_at, resolved_at, audience, photo_url,
      event_id,
      bet_options!bet_id(id, label),
      bet_entries(user_id, option_id, points_staked, is_anonymous, balances:user_id(display_name, username, avatar_url)),
      balances:creator_id(display_name, avatar_url, username),
      bet_reactions(user_id, emoji),
      bet_comments!bet_id(id)
    `)
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const audience = (bet as any).audience as string;

  if (audience !== "followers" && audience !== "select_people") {
    return NextResponse.json({ error: "use the event screen for event bets" }, { status: 400 });
  }

  const isCreator = (bet as any).creator_id === user.userId;

  if (!isCreator) {
    if (audience === "select_people") {
      // Must be explicitly invited
      const { data: invite } = await supabase
        .from("bet_invites")
        .select("user_id")
        .eq("bet_id", id)
        .eq("user_id", user.userId)
        .single();
      if (!invite) return NextResponse.json({ error: "not found" }, { status: 404 });
    } else {
      // followers bet: must follow creator or be in bet_invites
      const [{ data: follow }, { data: invite }] = await Promise.all([
        supabase.from("follows").select("follower_id").eq("follower_id", user.userId).eq("following_id", (bet as any).creator_id).eq("status", "accepted").single(),
        supabase.from("bet_invites").select("user_id").eq("bet_id", id).eq("user_id", user.userId).single(),
      ]);
      if (!follow && !invite) return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  const rawBet = bet as any;
  const sanitized = {
    ...redactAnonymousBet(rawBet, user.userId),
    bet_entries: redactAnonymousEntries(rawBet.bet_entries ?? [], user.userId),
  };

  return NextResponse.json({ bet: sanitized });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, status, event_id, events(host_id)")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.status !== "open") return NextResponse.json({ error: "cannot edit a resolved bet" }, { status: 422 });

  const isCreator = bet.creator_id === user.userId;
  const eventHost = Array.isArray(bet.events) ? bet.events[0] : bet.events;
  const isHost = (eventHost as { host_id: string } | null)?.host_id === user.userId;
  if (!isCreator && !isHost) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { deadline, question, question_tagged_user_ids, options, photo_url } = await req.json();

  // Only the creator can update question text / tags / options / photo
  if ((question !== undefined || question_tagged_user_ids !== undefined || options !== undefined || photo_url !== undefined) && !isCreator) {
    return NextResponse.json({ error: "only the bet creator can edit the question or options" }, { status: 403 });
  }

  // Editing options or question requires no one has staked yet
  if (options !== undefined || question !== undefined) {
    const { count } = await supabase
      .from("bet_entries")
      .select("*", { count: "exact", head: true })
      .eq("bet_id", id);
    if (count && count > 0) {
      return NextResponse.json({ error: "can't edit — someone has already staked on this prediction" }, { status: 422 });
    }
  }

  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: "at least 2 options required" }, { status: 400 });
    }
    const labels = (options as unknown[]).map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean);
    if (labels.length < 2) return NextResponse.json({ error: "options must be non-empty strings" }, { status: 400 });

    const { error: delError } = await supabase.from("bet_options").delete().eq("bet_id", id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    const { error: insError } = await supabase.from("bet_options").insert(labels.map((label) => ({ bet_id: id, label })));
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};
  if (deadline) updates.deadline = deadline;
  if (question !== undefined && isCreator) updates.question = question;
  if (question_tagged_user_ids !== undefined && isCreator) {
    updates.question_tagged_user_ids = Array.isArray(question_tagged_user_ids) ? question_tagged_user_ids : [];
  }
  if (photo_url !== undefined && isCreator) updates.photo_url = photo_url;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("bets").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, status, event_id, events(host_id)")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isCreator = bet.creator_id === user.userId;
  const eventHost = Array.isArray(bet.events) ? bet.events[0] : bet.events;
  const isHost = (eventHost as { host_id: string } | null)?.host_id === user.userId;
  if (!isCreator && !isHost) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  // Refund open stakes before deleting
  if (bet.status === "open") {
    const { data: entries } = await supabase
      .from("bet_entries")
      .select("user_id, points_staked")
      .eq("bet_id", id);
    if (entries && entries.length > 0) {
      const refunds = calculateRefunds(entries);
      await Promise.all(
        Object.entries(refunds).map(([uid, pts]) =>
          supabase.rpc("increment_balance", { p_user_id: uid, p_amount: pts })
        )
      );
    }
  }

  await supabase.from("notifications").delete().filter("data->>bet_id", "eq", id);
  const { error } = await supabase.from("bets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Claw back the creation reward from the creator
  await supabase.rpc("increment_balance", { p_user_id: bet.creator_id, p_amount: -100 });

  return NextResponse.json({ ok: true });
}
