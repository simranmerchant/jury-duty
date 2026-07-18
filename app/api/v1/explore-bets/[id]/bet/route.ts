import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/explore-bets/[id]/bet — place a wager on an explore bet
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
  const { side, points } = body;

  if (!["a", "b"].includes(side)) return NextResponse.json({ error: "side must be 'a' or 'b'" }, { status: 400 });
  if (!Number.isInteger(points) || points < 10) return NextResponse.json({ error: "points must be an integer >= 10" }, { status: 400 });

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id, status, closes_at")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.status !== "open") return NextResponse.json({ error: "betting is closed" }, { status: 422 });
  if (bet.closes_at && new Date(bet.closes_at) < new Date()) {
    return NextResponse.json({ error: "betting period has ended" }, { status: 422 });
  }

  // Check balance
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", user.userId)
    .single();

  if (!balance || balance.points < points) {
    return NextResponse.json({ error: "insufficient points" }, { status: 422 });
  }

  // Deduct points and create entry atomically — use the existing increment_balance RPC
  const [deductResult, entryResult] = await Promise.all([
    supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: -points }),
    supabase
      .from("explore_bet_entries")
      .insert({ explore_bet_id: id, user_id: user.userId, side, points_wagered: points })
      .select("id")
      .single(),
  ]);

  if (entryResult.error) {
    // Roll back the deduction if entry creation failed
    if (entryResult.error.code === "23505") {
      await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: points });
      return NextResponse.json({ error: "already placed a bet on this" }, { status: 409 });
    }
    await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: points });
    return NextResponse.json({ error: entryResult.error.message }, { status: 500 });
  }

  if (deductResult.error) {
    // Roll back entry
    await supabase.from("explore_bet_entries").delete().eq("id", entryResult.data.id);
    return NextResponse.json({ error: "could not deduct points" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
