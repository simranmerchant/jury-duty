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

  // Fetch all open events/groups the user is a guest of
  const { data: memberRows } = await supabase
    .from("event_guests")
    .select("event_id, events(id, name, type, ends_at)")
    .eq("user_id", user.userId);

  const openEvents = ((memberRows ?? []) as any[])
    .map((r) => r.events)
    .filter((e: any) => e && (!e.ends_at || new Date(e.ends_at) > new Date()));

  if (openEvents.length === 0) return NextResponse.json({ events: [] });

  const eventIds = openEvents.map((e: any) => e.id as string);
  const ql = q.toLowerCase();

  // Name-matched events
  const nameMatchIds = new Set(
    openEvents
      .filter((e: any) => (e.name as string).toLowerCase().startsWith(ql))
      .map((e: any) => e.id as string)
  );

  // Member-matched events: look for guests whose display_name or username starts with q
  const { data: guestRows } = await supabase
    .from("event_guests")
    .select("event_id, balances(display_name, username)")
    .in("event_id", eventIds)
    .neq("user_id", user.userId);

  // event_id → first matching member name
  const memberMatchMap = new Map<string, string>();
  for (const row of (guestRows ?? []) as any[]) {
    const b = row.balances;
    if (!b) continue;
    const nameMatch = b.display_name?.toLowerCase().startsWith(ql);
    const userMatch = b.username?.toLowerCase().startsWith(ql);
    if ((nameMatch || userMatch) && !memberMatchMap.has(row.event_id)) {
      memberMatchMap.set(row.event_id, b.display_name ?? b.username);
    }
  }

  const results = openEvents
    .filter((e: any) => nameMatchIds.has(e.id) || memberMatchMap.has(e.id))
    .map((e: any) => ({
      id: e.id,
      name: e.name,
      type: e.type as "event" | "group",
      ends_at: e.ends_at ?? null,
      matched_member: memberMatchMap.get(e.id) ?? null,
    }));

  return NextResponse.json({ events: results });
}
