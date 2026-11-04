import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: balance }, { data: statsData }, { data: agreementRow }, { data: blockRows }, { count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from("balances")
      .select("points, display_name, avatar_url, username, referral_code, is_private")
      .eq("user_id", user.userId)
      .single(),

    (supabase as any).rpc("get_user_stats", { p_user_id: user.userId }),

    supabase.from("user_agreements").select("user_id").eq("user_id", user.userId).single(),

    supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.userId),

    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.userId).eq("status", "accepted"),

    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.userId).eq("status", "accepted"),
  ]);

  const stats = statsData ?? { total: 0, won: 0, lost: 0, pending: 0 };

  return NextResponse.json({
    points: balance?.points ?? 0,
    display_name: balance?.display_name ?? null,
    avatar_url: balance?.avatar_url ?? null,
    username: balance?.username ?? null,
    referral_code: balance?.referral_code ?? null,
    is_private: balance?.is_private ?? false,
    follower_count: followerCount ?? 0,
    following_count: followingCount ?? 0,
    stats,
    has_agreed_to_terms: !!agreementRow,
    blocked_user_ids: (blockRows ?? []).map((r) => r.blocked_id),
  });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const uid = user.userId;

  // 1. Delete user's bets — cascades bet_options, bet_entries, bet_invites, bet_likes, bet_comments
  await supabase.from("bets").delete().eq("creator_id", uid);

  // 2. Delete remaining bet_entries in other users' bets
  await supabase.from("bet_entries").delete().eq("user_id", uid);

  // 3. Handle events this user hosts
  const { data: hostedEvents } = await supabase
    .from("events")
    .select("id")
    .eq("host_id", uid);

  await Promise.all(
    (hostedEvents ?? []).map(async (event) => {
      const { data: otherGuests } = await supabase
        .from("event_guests")
        .select("user_id")
        .eq("event_id", event.id)
        .neq("user_id", uid)
        .limit(1);

      if (otherGuests && otherGuests.length > 0) {
        // Transfer host to another member
        await supabase.from("events").update({ host_id: otherGuests[0].user_id }).eq("id", event.id);
      } else {
        // No other members — delete the event (cascades guests + bets inside it)
        await supabase.from("events").delete().eq("id", event.id);
      }
    })
  );

  // 4. Delete balances row — cascades posts, follows, notifications, push_tokens,
  //    event_guests, poll stuff, explore_bet_entries, post_likes, post_comments, etc.
  await supabase.from("balances").delete().eq("user_id", uid);

  // 5. Delete Supabase auth user
  if (user.provider === "supabase") {
    await supabase.auth.admin.deleteUser(uid);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.display_name === "string") {
    const name = body.display_name.trim();
    if (name.length < 1 || name.length > 40) {
      return NextResponse.json({ error: "name must be 1–40 characters" }, { status: 400 });
    }
    updates.display_name = name;
  }

  if (typeof body.is_private === "boolean") {
    updates.is_private = body.is_private;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("balances")
    .upsert({ user_id: user.userId, ...updates }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...updates });
}
