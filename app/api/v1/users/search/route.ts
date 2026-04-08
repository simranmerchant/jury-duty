import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sanitizeSearchQuery } from "@/lib/search";

// GET /api/v1/users/search?q=handle — search users by username or display name
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const q = sanitizeSearchQuery(raw);
  if (q.length < 1) return NextResponse.json({ users: [] });
  const safe = q;

  const { data, error } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url")
    .neq("user_id", user.userId)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    display_name: r.display_name ?? null,
    username: r.username ?? null,
    avatar_url: r.avatar_url ?? null,
  }));

  return NextResponse.json({ users });
}
