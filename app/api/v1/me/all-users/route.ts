import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/me/all-users — every user on the platform except self and blocked
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = user.userId;

  const { data: blockedRows } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", userId);

  const blockedIds = new Set((blockedRows ?? []).map((r: any) => r.blocked_id));

  const { data: balances } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url")
    .neq("user_id", userId)
    .not("username", "is", null)
    .order("display_name", { ascending: true });

  const users = (balances ?? [])
    .filter((b: any) => !blockedIds.has(b.user_id))
    .map((b: any) => ({
      user_id: b.user_id,
      display_name: b.display_name ?? null,
      username: b.username ?? null,
      avatar_url: b.avatar_url ?? null,
    }));

  return NextResponse.json({ users });
}
