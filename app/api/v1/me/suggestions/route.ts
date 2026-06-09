import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/me/suggestions — people who share an event/group with you, not yet followed
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = user.userId;

  // My event memberships with event names
  const { data: myMemberships } = await supabase
    .from("event_guests")
    .select("event_id, events(id, name, type)")
    .eq("user_id", userId);

  if (!myMemberships?.length) return NextResponse.json({ suggestions: [] });

  const myEventIds = myMemberships.map((r: any) => r.event_id);
  const eventInfoMap = new Map(
    myMemberships
      .map((r: any) => r.events)
      .filter(Boolean)
      .map((e: any) => [e.id, { name: e.name, type: e.type }])
  );

  // Co-members, followed, blocked in parallel
  const [{ data: coMemberRows }, { data: followedRows }, { data: blockedRows }] = await Promise.all([
    supabase
      .from("event_guests")
      .select("user_id, event_id")
      .in("event_id", myEventIds)
      .neq("user_id", userId),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId),
    supabase
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", userId),
  ]);

  const excludeIds = new Set([
    userId,
    ...(followedRows ?? []).map((r: any) => r.following_id),
    ...(blockedRows ?? []).map((r: any) => r.blocked_id),
  ]);

  // Group by user_id, collect mutual events
  const mutualMap = new Map<string, { names: string[]; eventIds: Set<string> }>();
  for (const row of (coMemberRows ?? []) as any[]) {
    if (excludeIds.has(row.user_id)) continue;
    if (!mutualMap.has(row.user_id)) {
      mutualMap.set(row.user_id, { names: [], eventIds: new Set() });
    }
    const entry = mutualMap.get(row.user_id)!;
    if (!entry.eventIds.has(row.event_id)) {
      entry.eventIds.add(row.event_id);
      const info = eventInfoMap.get(row.event_id);
      if (info) entry.names.push(info.name);
    }
  }

  if (mutualMap.size === 0) return NextResponse.json({ suggestions: [] });

  // Sort by mutual event count descending, cap at 30
  const sorted = [...mutualMap.entries()]
    .sort((a, b) => b[1].eventIds.size - a[1].eventIds.size)
    .slice(0, 30);

  const suggestionIds = sorted.map(([id]) => id);
  const { data: balances } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url")
    .in("user_id", suggestionIds);

  const balanceMap = new Map((balances ?? []).map((b: any) => [b.user_id, b]));

  const suggestions = sorted
    .filter(([id]) => balanceMap.has(id))
    .map(([id, { eventIds, names }]) => {
      const b = balanceMap.get(id)!;
      return {
        user_id: b.user_id,
        display_name: b.display_name ?? null,
        username: b.username ?? null,
        avatar_url: b.avatar_url ?? null,
        mutual_event_count: eventIds.size,
        mutual_event_names: names.slice(0, 2),
      };
    });

  return NextResponse.json({ suggestions });
}
