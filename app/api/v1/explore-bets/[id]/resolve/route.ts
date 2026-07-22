import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { computeExplorePayout } from "@/lib/explore-payout";

// POST /api/v1/explore-bets/[id]/resolve — resolve bet and pay out winners
// winning_side: 'a' | 'b' | null (null = void, refund all)
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
  const { winning_side } = body; // 'a' | 'b' | null

  if (winning_side !== null && !["a", "b"].includes(winning_side)) {
    return NextResponse.json({ error: "winning_side must be 'a', 'b', or null" }, { status: 400 });
  }

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id, question, status, creator_id")
    .eq("id", id)
    .single();

  const ADMIN_ID = "did:privy:cmng3anf401zu0cibp1adsvn3";
  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.creator_id !== user.userId && user.userId !== ADMIN_ID) return NextResponse.json({ error: "only the creator can resolve" }, { status: 403 });
  if (bet.status === "resolved") return NextResponse.json({ error: "already resolved" }, { status: 422 });

  const { data: entries } = await supabase
    .from("explore_bet_entries")
    .select("user_id, side, points_wagered")
    .eq("explore_bet_id", id);

  const allEntries = (entries ?? []) as Array<{ user_id: string; side: "a" | "b"; points_wagered: number }>;
  const payouts = computeExplorePayout(allEntries, winning_side);

  // Mark resolved
  const { error: updateError } = await supabase
    .from("explore_bets")
    .update({ status: "resolved", winning_side: winning_side ?? null })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Credit winners
  await Promise.all(
    Object.entries(payouts).map(([uid, pts]) =>
      supabase.rpc("increment_balance", { p_user_id: uid, p_amount: pts })
    )
  );

  // In-app + push notifications
  const allUserIds = [...new Set(allEntries.map((e) => e.user_id))];
  if (allUserIds.length > 0) {
    const notifData = { explore_bet_id: id };
    if (winning_side === null) {
      const payload = { title: "case dismissed", body: `"${bet.question}" was called off — you've been refunded` };
      await Promise.all([
        supabase.from("notifications").insert(allUserIds.map((uid) => ({ user_id: uid, type: "explore_bet_resolved", ...payload, data: notifData }))),
        sendPushToUsers(allUserIds, { ...payload, data: notifData }),
      ]);
    } else {
      const winnerIds = allEntries.filter((e) => e.side === winning_side).map((e) => e.user_id);
      const loserIds = allUserIds.filter((uid) => !winnerIds.includes(uid));
      const winPayload = { title: "jury's in — you won 🎉", body: `you called it on "${bet.question}"` };
      const losePayload = { title: "jury's in — you lost 💀", body: `the jury has spoken on "${bet.question}"` };
      await Promise.all([
        winnerIds.length > 0 && supabase.from("notifications").insert(winnerIds.map((uid) => ({ user_id: uid, type: "explore_bet_resolved", ...winPayload, data: notifData }))),
        loserIds.length > 0 && supabase.from("notifications").insert(loserIds.map((uid) => ({ user_id: uid, type: "explore_bet_resolved", ...losePayload, data: notifData }))),
        winnerIds.length > 0 && sendPushToUsers(winnerIds, { ...winPayload, data: notifData }),
        loserIds.length > 0 && sendPushToUsers(loserIds, { ...losePayload, data: notifData }),
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}
