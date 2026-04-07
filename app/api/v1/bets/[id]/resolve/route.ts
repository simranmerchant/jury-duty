import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { buildResolveNotifications } from "@/lib/resolve-notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: betId } = await params;
  const { winning_option_id } = await req.json();

  // winning_option_id = null means no winner — refund all
  const { error } = await supabase.rpc("resolve_bet", {
    p_resolver_id: user.userId,
    p_bet_id: betId,
    p_winning_option_id: winning_option_id ?? null,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("already resolved")) return NextResponse.json({ error: "already resolved" }, { status: 422 });
    if (msg.includes("not authorized")) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Send notifications to all participants
  const { data: bet } = await supabase
    .from("bets")
    .select("question, winning_option_id, bet_entries(user_id, option_id)")
    .eq("id", betId)
    .single();

  if (bet) {
    const notifications = buildResolveNotifications(
      betId,
      bet.question,
      bet.bet_entries as { user_id: string; option_id: string }[],
      winning_option_id ?? null
    );

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);

      // Push notifications
      const wonIds = notifications.filter((n) => n.type === "bet_resolved_won").map((n) => n.user_id);
      const lostIds = notifications.filter((n) => n.type === "bet_resolved_lost").map((n) => n.user_id);
      const refundIds = notifications.filter((n) => n.type === "bet_resolved_refunded").map((n) => n.user_id);
      await Promise.all([
        wonIds.length > 0 && sendPushToUsers(wonIds, { title: "jury's in — you won 🎉", body: `you called it on "${bet.question}"`, data: { bet_id: betId, outcome: "won" } }),
        lostIds.length > 0 && sendPushToUsers(lostIds, { title: "jury's in — you lost 💀", body: `the jury has spoken on "${bet.question}"`, data: { bet_id: betId, outcome: "lost" } }),
        refundIds.length > 0 && sendPushToUsers(refundIds, { title: "case dismissed", body: `"${bet.question}" was called off`, data: { bet_id: betId, outcome: "refunded" } }),
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}
