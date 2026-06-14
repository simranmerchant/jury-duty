import { NextRequest, NextResponse } from "next/server";
import { requireUser, privy } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendUSDC } from "@/lib/treasury";
import { centsToDisplay, validateWithdrawCents } from "@/lib/usdc";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const { cents } = body;
  const validationError = validateWithdrawCents(cents);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  // Fetch user's Privy embedded wallet for the destination
  const privyUser = await privy.getUserById(user.userId).catch(() => null);
  if (!privyUser) return NextResponse.json({ error: "could not fetch user wallets" }, { status: 500 });

  const embeddedWallet = (privyUser.linkedAccounts as any[]).find(
    (a) => a.type === "wallet" && a.walletClientType === "privy" && a.chainType === "ethereum"
  );
  if (!embeddedWallet?.address) {
    return NextResponse.json({ error: "no embedded wallet found — fund your account first" }, { status: 400 });
  }

  const toAddress = embeddedWallet.address as `0x${string}`;

  // Check and deduct balance atomically
  const { data: bal, error: balErr } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", user.userId)
    .single();

  if (balErr || !bal) return NextResponse.json({ error: "could not fetch balance" }, { status: 500 });

  const currentBalance = bal.points ?? 0;
  if (currentBalance < cents) {
    return NextResponse.json(
      { error: `insufficient balance — you have ${centsToDisplay(currentBalance)} available` },
      { status: 422 }
    );
  }

  const newBalance = currentBalance - cents;
  const { error: deductErr } = await supabase
    .from("balances")
    .update({ points: newBalance })
    .eq("user_id", user.userId)
    .eq("points", currentBalance); // optimistic lock: only update if balance unchanged

  if (deductErr) return NextResponse.json({ error: "balance changed during request, please retry" }, { status: 409 });

  // Send USDC from treasury to user's embedded wallet
  let txHash: `0x${string}`;
  try {
    txHash = await sendUSDC(toAddress, cents);
  } catch (err: any) {
    // Re-credit balance on failure
    await supabase.from("balances").update({ points: currentBalance }).eq("user_id", user.userId);
    return NextResponse.json({ error: err?.message ?? "transfer failed" }, { status: 500 });
  }

  // Record withdrawal
  await supabase.from("usdc_withdrawals").insert({
    user_id: user.userId,
    to_address: toAddress,
    cents,
    tx_hash: txHash,
  });

  return NextResponse.json({ ok: true, tx_hash: txHash, new_balance: newBalance });
}
