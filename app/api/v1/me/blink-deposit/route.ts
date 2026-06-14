import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { MIN_DEPOSIT_USD, MAX_DEPOSIT_USD } from "@/lib/blink";
import { displayToCents } from "@/lib/usdc";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { transfer_id, amount_usd } = await req.json().catch(() => ({}));
  if (!transfer_id || typeof transfer_id !== "string") {
    return NextResponse.json({ error: "missing transfer_id" }, { status: 400 });
  }
  if (!Number.isFinite(amount_usd) || amount_usd < MIN_DEPOSIT_USD || amount_usd > MAX_DEPOSIT_USD) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const pointsToCredit = displayToCents(amount_usd);

  // Insert first — unique constraint on transfer_id prevents double-crediting
  const { error: insertErr } = await supabase.from("blink_deposits").insert({
    user_id: user.userId,
    transfer_id,
    amount_usd,
    points_credited: pointsToCredit,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "deposit already credited" }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Atomically increment points
  const { data: bal, error: balErr } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", user.userId)
    .single();

  if (balErr) return NextResponse.json({ error: balErr.message }, { status: 500 });

  const newPoints = (bal?.points ?? 0) + pointsToCredit;
  const { error: updateErr } = await supabase
    .from("balances")
    .update({ points: newPoints })
    .eq("user_id", user.userId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, points_credited: pointsToCredit, new_balance: newPoints });
}
