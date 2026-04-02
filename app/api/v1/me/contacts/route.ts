import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// Returns all users who share at least one event/group with the current user.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Get all events the user is in
  const { data: myMemberships } = await supabase
    .from("event_guests")
    .select("event_id")
    .eq("user_id", user.userId);

  const eventIds = (myMemberships ?? []).map((r: any) => r.event_id);
  if (eventIds.length === 0) return NextResponse.json({ contacts: [] });

  // Get all other users from those events, with their profile info
  const { data: rows } = await supabase
    .from("event_guests")
    .select("user_id, balances(display_name, avatar_url)")
    .in("event_id", eventIds)
    .neq("user_id", user.userId);

  // Deduplicate by user_id
  const seen = new Set<string>();
  const contacts = (rows ?? [])
    .filter((r: any) => {
      if (seen.has(r.user_id)) return false;
      seen.add(r.user_id);
      return true;
    })
    .map((r: any) => ({
      userId: r.user_id,
      displayName: r.balances?.display_name ?? null,
      avatarUrl: r.balances?.avatar_url ?? null,
    }));

  return NextResponse.json({ contacts });
}
