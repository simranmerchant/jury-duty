import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

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

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.creator_id !== user.userId) return NextResponse.json({ error: "only the creator can resolve" }, { status: 403 });
  if (bet.status === "resolved") return NextResponse.json({ error: "already resolved" }, { status: 422 });

  const { data: entries } = await supabase
    .from("explore_bet_entries")
    .select("user_id, side, points_wagered")
    .eq("explore_bet_id", id);

  const allEntries = (entries ?? []) as Array<{ user_id: string; side: string; points_wagered: number }>;

  // Compute payouts
  const payouts: Record<string, number> = {};

  if (winning_side === null) {
    // Void: refund everyone
    for (const e of allEntries) {
      payouts[e.user_id] = (payouts[e.user_id] ?? 0) + e.points_wagered;
    }
  } else {
    const winners = allEntries.filter((e) => e.side === winning_side);
    const losers = allEntries.filter((e) => e.side !== winning_side);

    if (winners.length === 0) {
      // No one on winning side — refund all
      for (const e of allEntries) {
        payouts[e.user_id] = (payouts[e.user_id] ?? 0) + e.points_wagered;
      }
    } else {
      const totalPot = allEntries.reduce((s, e) => s + e.points_wagered, 0);
      const winnerTotal = winners.reduce((s, e) => s + e.points_wagered, 0);

      // Proportional payout: each winner gets (their_stake / winner_total) * total_pot
      let distributed = 0;
      for (let i = 0; i < winners.length; i++) {
        const w = winners[i];
        const share = i < winners.length - 1
          ? Math.floor((w.points_wagered / winnerTotal) * totalPot)
          : totalPot - distributed; // last winner gets remainder
        payouts[w.user_id] = (payouts[w.user_id] ?? 0) + share;
        distributed += share;
      }
    }
  }

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

  // Push notifications
  const allUserIds = [...new Set(allEntries.map((e) => e.user_id))];
  if (allUserIds.length > 0) {
    if (winning_side === null) {
      await sendPushToUsers(allUserIds, {
        title: "case dismissed",
        body: `"${bet.question}" was called off — you've been refunded`,
        data: { explore_bet_id: id },
      });
    } else {
      const winnerIds = winners_list(allEntries, winning_side);
      const loserIds = allUserIds.filter((uid) => !winnerIds.includes(uid));
      await Promise.all([
        winnerIds.length > 0 && sendPushToUsers(winnerIds, {
          title: "jury's in — you won 🎉",
          body: `you called it on "${bet.question}"`,
          data: { explore_bet_id: id },
        }),
        loserIds.length > 0 && sendPushToUsers(loserIds, {
          title: "jury's in — you lost 💀",
          body: `the jury has spoken on "${bet.question}"`,
          data: { explore_bet_id: id },
        }),
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}

function winners_list(entries: Array<{ user_id: string; side: string }>, winning_side: string) {
  return entries.filter((e) => e.side === winning_side).map((e) => e.user_id);
}
