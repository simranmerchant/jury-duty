import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// GET /api/v1/me/history?filter=won|lost|open
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const filter = req.nextUrl.searchParams.get("filter") ?? "all";

  const statusFilter = filter === "open" ? ["open"] : ["resolved"];

  const { data: entries, error } = await supabase
    .from("bet_entries")
    .select("id, option_id, points_staked, bets!inner(id, question, status, winning_option_id, event_id, deadline)")
    .eq("user_id", user.userId)
    .eq("is_hidden_from_profile", false)
    .in("bets.status", filter === "open" ? ["open"] : ["resolved"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (entries ?? [])
    .map((e: any) => {
      const bet = e.bets;
      const isResolved = bet.status === "resolved";
      const won = isResolved && bet.winning_option_id === e.option_id;
      const lost = isResolved && bet.winning_option_id !== null && bet.winning_option_id !== e.option_id;
      const outcome: "won" | "lost" | "open" = won ? "won" : lost ? "lost" : "open";
      return { id: e.id, bet_id: bet.id, question: bet.question, points_staked: e.points_staked, outcome, event_id: bet.event_id, deadline: bet.deadline };
    })
    .filter((e) => filter === "all" || e.outcome === filter);

  return NextResponse.json({ entries: shaped });
}
