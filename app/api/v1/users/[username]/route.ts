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
    .select("user_id, display_name, username, avatar_url, points, is_private")
    .eq("username", u)
    .single();

  if (!balance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const userId = balance.user_id;

  // Fetch entries, memberships, follow counts, and viewer's follow state in parallel
  const [{ data: entries }, { data: memberships }, { data: followerRows }, { data: followingRows }, { data: viewerFollow }] = await Promise.all([
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
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("status", "accepted"),
    viewer
      ? supabase
          .from("follows")
          .select("status")
          .eq("follower_id", viewer.userId)
          .eq("following_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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

  if (viewer && viewer.userId !== userId) {
    const { data: viewerMemberships } = await supabase
      .from("event_guests")
      .select("event_id")
      .eq("user_id", viewer.userId);

    mutual_events = (viewerMemberships ?? [])
      .map((r: any) => r.event_id)
      .filter((id: string) => profileEventIds.has(id))
      .map((id: string) => profileEventsById.get(id))
      .filter(Boolean) as { id: string; name: string; type: string }[];
  }

  return NextResponse.json({
    user: {
      user_id: balance.user_id,
      display_name: balance.display_name ?? null,
      username: balance.username,
      avatar_url: balance.avatar_url ?? null,
      points: balance.points ?? 0,
      is_private: balance.is_private ?? false,
      follower_count: followerRows ?? 0,
      following_count: followingRows ?? 0,
      follow_status: viewerFollow?.status ?? null,
    },
    win_rate,
    mutual_events,
  });
}
