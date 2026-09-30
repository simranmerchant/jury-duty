import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// GET /api/v1/events/match?userIds=id1,id2,...
// Returns the first group/event whose membership is exactly {currentUser} + {userIds}.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const targetIds = url.searchParams.get("userIds")?.split(",").filter(Boolean) ?? [];
  if (targetIds.length < 2) return NextResponse.json({ event: null });

  // Step 1: events the current user belongs to
  const { data: myMemberships } = await supabase
    .from("event_guests")
    .select("event_id")
    .eq("user_id", user.userId);

  const myEventIds = (myMemberships ?? []).map((m: { event_id: string }) => m.event_id);
  if (!myEventIds.length) return NextResponse.json({ event: null });

  // Step 2: all guests + event metadata for those events
  const { data: rows } = await supabase
    .from("event_guests")
    .select("event_id, user_id, events(id, name, type)")
    .in("event_id", myEventIds);

  // Build a map: eventId → { name, type, memberSet }
  type Info = { name: string; type: string; users: Set<string> };
  const eventMap = new Map<string, Info>();
  for (const r of rows ?? []) {
    const ev = (Array.isArray(r.events) ? r.events[0] : r.events) as { id: string; name: string; type: string } | null;
    if (!ev || !["group", "event"].includes(ev.type)) continue;
    if (!eventMap.has(r.event_id)) {
      eventMap.set(r.event_id, { name: ev.name, type: ev.type, users: new Set() });
    }
    eventMap.get(r.event_id)!.users.add(r.user_id);
  }

  // Step 3: exact match — members must be exactly { currentUser, ...targetIds }
  const expectedSize = targetIds.length + 1;
  const expectedUsers = new Set([...targetIds, user.userId]);

  for (const [eventId, { name, type, users }] of eventMap) {
    if (users.size === expectedSize && [...expectedUsers].every((u) => users.has(u))) {
      return NextResponse.json({ event: { id: eventId, name, type } });
    }
  }

  return NextResponse.json({ event: null });
}
