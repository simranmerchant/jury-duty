import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: balance }, { data: entries }] = await Promise.all([
    supabase
      .from("balances")
      .select("points, display_name")
      .eq("user_id", user.userId)
      .single(),

    supabase
      .from("bet_entries")
      .select(`
        id, points_staked, option_id,
        bet_options(label),
        bets(
          id, question, status, winning_option_id,
          events(id, name)
        )
      `)
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false }),
  ]);

  // Compute outcome for each entry
  const history = (entries ?? []).map((e: any) => {
    const bet = e.bets;
    let outcome: "pending" | "won" | "lost" | "refunded" = "pending";
    if (bet.status === "resolved") {
      if (bet.winning_option_id === null) outcome = "refunded";
      else if (bet.winning_option_id === e.option_id) outcome = "won";
      else outcome = "lost";
    }
    return {
      id: e.id,
      bet_id: bet.id,
      event_id: bet.events?.id,
      event_name: bet.events?.name,
      question: bet.question,
      pick: e.bet_options?.label,
      points_staked: e.points_staked,
      outcome,
    };
  });

  const stats = {
    total: history.length,
    won: history.filter((h) => h.outcome === "won").length,
    lost: history.filter((h) => h.outcome === "lost").length,
    pending: history.filter((h) => h.outcome === "pending").length,
  };

  return NextResponse.json({ points: balance?.points ?? 0, display_name: balance?.display_name ?? null, history, stats });
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { display_name } = await req.json();
  const name = display_name?.trim();
  if (!name || name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "name must be 1–40 characters" }, { status: 400 });
  }

  const { error } = await supabase
    .from("balances")
    .update({ display_name: name })
    .eq("user_id", user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ display_name: name });
}
