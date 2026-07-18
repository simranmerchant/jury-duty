import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { points } = body;

  if (!Number.isInteger(points) || points < 10)
    return NextResponse.json({ error: "points must be an integer >= 10" }, { status: 400 });

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id, status, closes_at")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.status !== "open") return NextResponse.json({ error: "betting is closed" }, { status: 422 });
  if (bet.closes_at && new Date(bet.closes_at) < new Date())
    return NextResponse.json({ error: "betting period has ended" }, { status: 422 });

  const { data: entry } = await supabase
    .from("explore_bet_entries")
    .select("id, points_wagered")
    .eq("explore_bet_id", id)
    .eq("user_id", user.userId)
    .single();

  if (!entry) return NextResponse.json({ error: "you haven't bet on this yet" }, { status: 422 });

  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", user.userId)
    .single();

  if (!balance || balance.points < points)
    return NextResponse.json({ error: "insufficient points" }, { status: 422 });

  const [deductResult, updateResult] = await Promise.all([
    supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: -points }),
    supabase
      .from("explore_bet_entries")
      .update({ points_wagered: entry.points_wagered + points })
      .eq("id", entry.id),
  ]);

  if (updateResult.error) {
    await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: points });
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  if (deductResult.error) {
    await supabase.from("explore_bet_entries").update({ points_wagered: entry.points_wagered }).eq("id", entry.id);
    return NextResponse.json({ error: "could not deduct points" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
