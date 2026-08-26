import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { normalizePhones } from "@/lib/contacts";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawPhones: unknown = body?.phones;
  if (!Array.isArray(rawPhones) || rawPhones.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const phones = normalizePhones(rawPhones.slice(0, 5000));
  if (phones.length === 0) return NextResponse.json({ users: [] });

  // Find users whose phone matches, excluding self and already-followed users.
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.userId)
    .eq("status", "accepted");

  const followedIds = new Set((follows ?? []).map((f: any) => f.following_id));

  const { data: matched } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url")
    .in("phone", phones)
    .neq("user_id", user.userId);

  const users = (matched ?? [])
    .filter((u: any) => !followedIds.has(u.user_id))
    .map((u: any) => ({
      user_id: u.user_id,
      display_name: u.display_name,
      username: u.username,
      avatar_url: u.avatar_url,
    }));

  return NextResponse.json({ users });
}
