import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { extractMentions } from "@/lib/mention";

// POST /api/v1/posts — share a resolved public bet to your followers' feed
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { bet_id, caption, photo_url, targeted_user_ids } = body;

  if (!bet_id) return NextResponse.json({ error: "bet_id required" }, { status: 400 });
  if (caption && caption.length > 280) return NextResponse.json({ error: "caption too long" }, { status: 400 });
  if (photo_url && typeof photo_url !== "string") return NextResponse.json({ error: "invalid photo_url" }, { status: 400 });
  if (targeted_user_ids !== undefined && !Array.isArray(targeted_user_ids))
    return NextResponse.json({ error: "targeted_user_ids must be an array" }, { status: 400 });

  // Validate bet: must exist, be resolved, and be public
  const { data: bet } = await supabase
    .from("bets")
    .select("id, status, visibility, creator_id")
    .eq("id", bet_id)
    .single();

  if (!bet) return NextResponse.json({ error: "bet not found" }, { status: 404 });
  if (bet.visibility === "private") return NextResponse.json({ error: "private bets cannot be shared" }, { status: 403 });

  // Must be creator or have participated
  const isCreator = bet.creator_id === user.userId;
  if (!isCreator) {
    const { data: entry } = await supabase
      .from("bet_entries")
      .select("id")
      .eq("bet_id", bet_id)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (!entry) return NextResponse.json({ error: "you must have participated in this bet to share it" }, { status: 403 });
  }

  // Upsert so resharing bumps the post to the top of the feed
  const { data: post, error } = await supabase
    .from("posts")
    .upsert({
      user_id: user.userId,
      bet_id,
      caption: caption?.trim() || null,
      photo_url: photo_url || null,
      targeted_user_ids: targeted_user_ids?.length ? targeted_user_ids : null,
      created_at: new Date().toISOString(),
    }, { onConflict: "user_id,bet_id" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify @mentioned users
  const captionText = caption?.trim() ?? "";
  const mentionedUsernames = extractMentions(captionText);
  if (mentionedUsernames.length > 0) {
    const [senderRes, mentionedRes] = await Promise.all([
      supabase.from("balances").select("display_name, username").eq("user_id", user.userId).single(),
      supabase.from("balances").select("user_id, username").in("username", mentionedUsernames),
    ]);
    const senderName = senderRes.data?.display_name ?? senderRes.data?.username ?? "someone";
    const mentionedIds = (mentionedRes.data ?? []).map((m: { user_id: string }) => m.user_id).filter((id) => id !== user.userId);
    if (mentionedIds.length > 0) {
      const notifData = { post_id: post.id, bet_id };
      await Promise.all([
        supabase.from("notifications").insert(
          mentionedIds.map((uid: string) => ({
            user_id: uid,
            type: "post_mention",
            title: `${senderName} mentioned you`,
            body: captionText.slice(0, 80),
            data: notifData,
          }))
        ),
        sendPushToUsers(mentionedIds, {
          title: `${senderName} mentioned you in a post`,
          body: captionText.slice(0, 80),
          data: notifData,
        }),
      ]);
    }
  }

  return NextResponse.json({ id: post.id });
}

// DELETE /api/v1/posts?post_id=... or ?bet_id=... — delete a shared post
export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const post_id = searchParams.get("post_id");
  const bet_id = searchParams.get("bet_id");

  if (post_id) {
    await Promise.all([
      supabase.from("notifications").delete().like("data::text", `%${post_id}%`),
      supabase.from("posts").delete().eq("id", post_id).eq("user_id", user.userId),
    ]);
  } else if (bet_id) {
    const { data: deleted } = await supabase.from("posts").delete().eq("bet_id", bet_id).eq("user_id", user.userId).select("id");
    if (deleted && deleted.length > 0) {
      await Promise.all(deleted.map((p) => supabase.from("notifications").delete().like("data::text", `%${p.id}%`)));
    }
  } else {
    return NextResponse.json({ error: "post_id or bet_id required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
