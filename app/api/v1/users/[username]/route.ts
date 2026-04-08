import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { computeOutcome } from "@/lib/outcome";

// GET /api/v1/users/[username] — public profile (auth optional)
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = username?.toLowerCase().trim();
  if (!u) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const viewer = token ? await requireUser(token).catch(() => null) : null;

  const { data: balance } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url, points")
    .eq("username", u)
    .single();

  if (!balance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const userId = balance.user_id;

  // Fetch entries only to compute win_rate — individual bets not exposed publicly
  const [{ data: entries }, { data: memberships }] = await Promise.all([
    supabase
      .from("bet_entries")
      .select("option_id, bets(status, winning_option_id, visibility)")
      .eq("user_id", userId)
      .eq("is_anonymous", false)
      .eq("is_hidden_from_profile", false),
    supabase
      .from("event_guests")
      .select("events(id, name, type)")
      .eq("user_id", userId),
  ]);

  const publicEntries = (entries ?? []).filter((e: any) => e.bets?.visibility === "public");
  const outcomes = publicEntries.map((e: any) =>
    computeOutcome(e.bets.status, e.bets.winning_option_id, e.option_id),
  );
  const resolved = outcomes.filter((o) => o === "won" || o === "lost");
  const won = outcomes.filter((o) => o === "won").length;
  const win_rate = resolved.length > 0 ? Math.round((won / resolved.length) * 100) : null;

  const profileEventIds = new Set(
    (memberships ?? []).map((m: any) => m.events?.id).filter(Boolean),
  );
  const profileEventsById = new Map(
    (memberships ?? [])
      .map((m: any) => m.events)
      .filter(Boolean)
      .map((e: any) => [e.id, { id: e.id, name: e.name, type: e.type }]),
  );

  let mutual_events: { id: string; name: string; type: string }[] = [];
  let shared_bets: { bet_id: string; question: string; event_id: string | null; event_name: string | null; status: string }[] = [];

  if (viewer && viewer.userId !== userId) {
    const [{ data: viewerMemberships }, { data: viewerEntries }] = await Promise.all([
      supabase.from("event_guests").select("event_id").eq("user_id", viewer.userId),
      supabase.from("bet_entries").select("bet_id").eq("user_id", viewer.userId).eq("is_anonymous", false),
    ]);

    mutual_events = (viewerMemberships ?? [])
      .map((r: any) => r.event_id)
      .filter((id: string) => profileEventIds.has(id))
      .map((id: string) => profileEventsById.get(id))
      .filter(Boolean) as { id: string; name: string; type: string }[];

    const viewerBetIds = (viewerEntries ?? []).map((e: any) => e.bet_id);
    if (viewerBetIds.length > 0) {
      const { data: profileEntries } = await supabase
        .from("bet_entries")
        .select("bet_id, bets(id, question, status, visibility, events(id, name))")
        .eq("user_id", userId)
        .eq("is_anonymous", false)
        .in("bet_id", viewerBetIds);

      shared_bets = (profileEntries ?? [])
        .filter((e: any) => e.bets?.visibility === "public")
        .map((e: any) => ({
          bet_id: e.bets.id,
          question: e.bets.question,
          event_id: e.bets.events?.id ?? null,
          event_name: e.bets.events?.name ?? null,
          status: e.bets.status,
        }));
    }
  }

  return NextResponse.json({
    user: {
      user_id: balance.user_id,
      display_name: balance.display_name ?? null,
      username: balance.username,
      avatar_url: balance.avatar_url ?? null,
      points: balance.points ?? 0,
    },
    win_rate,
    mutual_events,
    shared_bets,
  });
}
