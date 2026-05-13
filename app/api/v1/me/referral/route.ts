import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "code required" }, { status: 400 });

  // Check user hasn't already used a referral
  const { data: me } = await supabase
    .from("balances")
    .select("referred_by")
    .eq("user_id", user.userId)
    .single();

  if (me?.referred_by) return NextResponse.json({ error: "you've already used a referral code" }, { status: 422 });

  // Find referrer by code
  const { data: referrer } = await supabase
    .from("balances")
    .select("user_id")
    .eq("referral_code", code.trim().toLowerCase())
    .single();

  if (!referrer) return NextResponse.json({ error: "invalid referral code" }, { status: 404 });
  if (referrer.user_id === user.userId) return NextResponse.json({ error: "you can't use your own referral code" }, { status: 422 });

  // Award referrer + mark this user as referred
  await Promise.all([
    supabase.from("balances").update({ referred_by: referrer.user_id }).eq("user_id", user.userId),
    supabase.rpc("increment_balance", { p_user_id: referrer.user_id, p_amount: 100 }),
  ]);

  return NextResponse.json({ ok: true });
}
