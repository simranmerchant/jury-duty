import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { parseFeedCapabilities } from "@/lib/feed";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? null;

  const { supportsPollPost, supportsExploreBetPost } = parseFeedCapabilities(
    req.headers.get("x-feed-capabilities") ?? ""
  );

  const { data, error } = await (supabase as any).rpc("get_feed", {
    p_user_id: user.userId,
    p_cursor: cursor,
    p_supports_poll_post: supportsPollPost,
    p_supports_explore_bet: supportsExploreBetPost,
  });

  if (error) {
    console.error("[feed] rpc error:", error.message);
    return NextResponse.json({ error: "feed unavailable" }, { status: 500 });
  }

  return NextResponse.json(data);
}
