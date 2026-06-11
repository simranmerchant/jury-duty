import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

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
      id, question, deadline, status, winning_option_id, creator_id, created_at, audience,
      event_id,
      bet_options!bet_id(id, label),
      bet_entries(user_id, option_id, points_staked, is_anonymous),
      balances:creator_id(display_name, avatar_url, username)
    `)
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Feed bets are publicly visible to anyone authenticated
  if ((bet as any).audience !== "followers") {
    return NextResponse.json({ error: "use the event screen for event bets" }, { status: 400 });
  }

  return NextResponse.json({ bet });
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

  const { deadline, question, question_tagged_user_ids } = await req.json();

  // Only the creator can update question text / tags
  if ((question !== undefined || question_tagged_user_ids !== undefined) && !isCreator) {
    return NextResponse.json({ error: "only the bet creator can tag users in the question" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (deadline) updates.deadline = deadline;
  if (question !== undefined && isCreator) updates.question = question;
  if (question_tagged_user_ids !== undefined && isCreator) {
    updates.question_tagged_user_ids = Array.isArray(question_tagged_user_ids) ? question_tagged_user_ids : [];
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { error } = await supabase.from("bets").update(updates).eq("id", id);
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
      const refunds: Record<string, number> = {};
      for (const e of entries) refunds[e.user_id] = (refunds[e.user_id] ?? 0) + e.points_staked;
      await Promise.all(
        Object.entries(refunds).map(([uid, pts]) =>
          supabase.rpc("increment_balance", { p_user_id: uid, p_amount: pts })
        )
      );
    }
  }

  const { error } = await supabase.from("bets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Claw back the creation reward from the creator
  await supabase.rpc("increment_balance", { p_user_id: bet.creator_id, p_amount: -100 });

  return NextResponse.json({ ok: true });
}
