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

  const { deadline } = await req.json();
  if (!deadline) return NextResponse.json({ error: "deadline required" }, { status: 400 });

  const { error } = await supabase.from("bets").update({ deadline }).eq("id", id);
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
