import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find all open bets past their deadline that haven't been notified yet
  const { data: overdueBets, error } = await supabase
    .from("bets")
    .select("id, title, creator_id")
    .eq("status", "open")
    .eq("deadline_notified", false)
    .lt("deadline", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!overdueBets || overdueBets.length === 0) return NextResponse.json({ notified: 0 });

  const notifications = overdueBets.map((bet) => ({
    user_id: bet.creator_id,
    type: "bet_deadline",
    title: "time to deliberate 🔨",
    body: `"${bet.title}" is past its deadline. the jury is waiting — go resolve it.`,
    data: { bet_id: bet.id },
  }));

  await supabase.from("notifications").insert(notifications);

  // Mark them all notified
  await supabase
    .from("bets")
    .update({ deadline_notified: true })
    .in("id", overdueBets.map((b) => b.id));

  return NextResponse.json({ notified: overdueBets.length });
}
