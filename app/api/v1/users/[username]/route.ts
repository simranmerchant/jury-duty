import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

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

  // Fetch win rate via RPC, memberships, follow counts, and viewer's follow state in parallel
  const [{ data: winRateData }, { data: memberships }, { count: followerCount }, { count: followingCount }, { data: viewerFollow }] = await Promise.all([
    (supabase as any).rpc("get_user_win_rate", { p_user_id: userId }),
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

  const totalResolved = winRateData?.total_resolved ?? 0;
  const wonCount = winRateData?.won ?? 0;
  const win_rate = totalResolved > 0 ? Math.round((wonCount / totalResolved) * 100) : null;

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
      follower_count: followerCount ?? 0,
      following_count: followingCount ?? 0,
      follow_status: viewerFollow?.status ?? null,
    },
    win_rate,
    mutual_events,
  });
}
