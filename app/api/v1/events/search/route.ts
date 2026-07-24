import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sanitizeSearchQuery } from "@/lib/search";

// GET /api/v1/events/search?q=... — search user's open groups/events by name or member name
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const q = sanitizeSearchQuery(raw);
  if (q.length < 1) return NextResponse.json({ events: [] });

  const ql = q.toLowerCase();

  // Fetch events/groups the user belongs to (same pattern as GET /api/v1/events)
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, name, type, ends_at, event_guests!inner(user_id)")
    .eq("event_guests.user_id", user.userId);

  // Filter to open (groups have no ends_at; events must not be in the past)
  const openEvents = ((eventsData ?? []) as { id: string; name: string; type: string; ends_at: string | null }[])
    .filter((e) => !e.ends_at || new Date(e.ends_at) > new Date());
  if (openEvents.length === 0) return NextResponse.json({ events: [] });

  const eventIds = openEvents.map((e) => e.id);

  // Name-matched events
  const nameMatchIds = new Set(
    openEvents.filter((e) => e.name.toLowerCase().startsWith(ql)).map((e) => e.id)
  );

  // Member-matched: find guests whose display_name or username starts with q
  const { data: guestRows } = await supabase
    .from("event_guests")
    .select("event_id, balances(display_name, username)")
    .in("event_id", eventIds)
    .neq("user_id", user.userId);

  const memberMatchMap = new Map<string, string>();
  for (const row of (guestRows ?? []) as any[]) {
    const b = row.balances;
    if (!b) continue;
    if (
      (b.display_name?.toLowerCase().startsWith(ql) || b.username?.toLowerCase().startsWith(ql)) &&
      !memberMatchMap.has(row.event_id)
    ) {
      memberMatchMap.set(row.event_id, b.display_name ?? b.username);
    }
  }

  const results = openEvents
    .filter((e) => nameMatchIds.has(e.id) || memberMatchMap.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type as "event" | "group",
      ends_at: e.ends_at,
      matched_member: memberMatchMap.get(e.id) ?? null,
    }));

  return NextResponse.json({ events: results });
}
