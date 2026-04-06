import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { computeOutcome } from "@/lib/outcome";

// GET /api/v1/users/[username] — public profile (auth optional, used for mutual events)
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = username?.toLowerCase().trim();
  if (!u) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const viewer = token ? await requireUser(token).catch(() => null) : null;

  const { data: balance } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url")
    .eq("username", u)
    .single();

  if (!balance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const userId = balance.user_id;

  const [{ data: taggedOptions }, { data: entries }] = await Promise.all([
    supabase
      .from("bet_options")
      .select("id, label, bets(id, question, status, winning_option_id, visibility, events(id, name))")
      .eq("tagged_user_id", userId),
    supabase
      .from("bet_entries")
      .select("id, points_staked, option_id, bet_options(label), bets(id, question, status, winning_option_id, visibility, events(id, name))")
      .eq("user_id", userId)
      .eq("is_anonymous", false)
      .eq("is_hidden_from_profile", false)
      .order("created_at", { ascending: false }),
  ]);

  const taggedBets = (taggedOptions ?? [])
    .filter((o: any) => o.bets?.visibility === "public")
    .map((o: any) => ({
      bet_id: o.bets.id,
      question: o.bets.question,
      label: o.label,
      event_id: o.bets.events?.id ?? null,
      event_name: o.bets.events?.name ?? null,
      status: o.bets.status,
      outcome: computeOutcome(o.bets.status, o.bets.winning_option_id, o.id),
    }));

  const history = (entries ?? [])
    .filter((e: any) => e.bets?.visibility === "public")
    .map((e: any) => ({
      id: e.id,
      bet_id: e.bets.id,
      event_id: e.bets.events?.id ?? null,
      event_name: e.bets.events?.name ?? null,
      question: e.bets.question,
      pick: e.bet_options?.label,
      points_staked: e.points_staked,
      outcome: computeOutcome(e.bets.status, e.bets.winning_option_id, e.option_id),
    }));

  const resolved = history.filter((h) => h.outcome === "won" || h.outcome === "lost");
  const stats = {
    total: history.length,
    won: history.filter((h) => h.outcome === "won").length,
    lost: history.filter((h) => h.outcome === "lost").length,
    pending: history.filter((h) => h.outcome === "pending").length,
    win_rate: resolved.length > 0
      ? Math.round((history.filter((h) => h.outcome === "won").length / resolved.length) * 100)
      : null,
  };

  let mutual_events: { id: string; name: string; type: string }[] = [];
  if (viewer && viewer.userId !== userId) {
    const [{ data: myMemberships }, { data: theirMemberships }] = await Promise.all([
      supabase.from("event_guests").select("event_id").eq("user_id", viewer.userId),
      supabase.from("event_guests").select("event_id").eq("user_id", userId),
    ]);
    const myIds = new Set((myMemberships ?? []).map((r: any) => r.event_id));
    const sharedIds = (theirMemberships ?? [])
      .map((r: any) => r.event_id)
      .filter((id: string) => myIds.has(id));

    if (sharedIds.length > 0) {
      const { data: sharedEvents } = await supabase
        .from("events")
        .select("id, name, type")
        .in("id", sharedIds);
      mutual_events = (sharedEvents ?? []).map((e: any) => ({ id: e.id, name: e.name, type: e.type }));
    }
  }

  return NextResponse.json({
    user: {
      user_id: balance.user_id,
      display_name: balance.display_name ?? null,
      username: balance.username,
      avatar_url: balance.avatar_url ?? null,
    },
    tagged_bets: taggedBets,
    history,
    stats,
    mutual_events,
  });
}
