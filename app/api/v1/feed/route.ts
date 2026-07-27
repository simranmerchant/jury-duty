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

  // Collect unique author IDs across all feed items (exclude self)
  const items: any[] = data?.items ?? (Array.isArray(data) ? data : []);
  const authorIds = new Set<string>();
  for (const item of items) {
    const id = item.user_id ?? item.creator_id;
    if (id && id !== user.userId) authorIds.add(id);
  }

  // Batch-fetch follow statuses for all authors in one query
  let follow_statuses: Record<string, string> = {};
  if (authorIds.size > 0) {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id, status")
      .eq("follower_id", user.userId)
      .in("following_id", [...authorIds]);
    for (const f of follows ?? []) {
      follow_statuses[f.following_id] = f.status;
    }
  }

  // Merge follow_statuses into the response without modifying item shapes
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return NextResponse.json({ ...data, follow_statuses });
  }
  return NextResponse.json({ items: data, follow_statuses });
}
