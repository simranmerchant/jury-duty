import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { bet_id, option_id, points, is_anonymous } = await req.json();
  if (!bet_id || !option_id || !points) {
    return NextResponse.json({ error: "bet_id, option_id, and points required" }, { status: 400 });
  }
  if (typeof points !== "number" || points <= 0) {
    return NextResponse.json({ error: "points must be a positive number" }, { status: 400 });
  }

  // Access control: verify user can see this bet before letting them vote
  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, audience")
    .eq("id", bet_id)
    .single();

  if (!bet) return NextResponse.json({ error: "bet not found" }, { status: 404 });

  const isCreator = bet.creator_id === user.userId;
  if (!isCreator) {
    const audience = (bet as any).audience as string;
    if (audience === "select_people") {
      const { data: invite } = await supabase
        .from("bet_invites")
        .select("user_id")
        .eq("bet_id", bet_id)
        .eq("user_id", user.userId)
        .single();
      if (!invite) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    } else if (audience === "followers") {
      const [{ data: follow }, { data: invite }] = await Promise.all([
        supabase.from("follows").select("follower_id").eq("follower_id", user.userId).eq("following_id", bet.creator_id).eq("status", "accepted").single(),
        supabase.from("bet_invites").select("user_id").eq("bet_id", bet_id).eq("user_id", user.userId).single(),
      ]);
      if (!follow && !invite) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    }
  }

  const { error } = await supabase.rpc("place_bet", {
    p_user_id: user.userId,
    p_bet_id: bet_id,
    p_option_id: option_id,
    p_points: points,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("insufficient balance")) return NextResponse.json({ error: "insufficient balance" }, { status: 422 });
    if (msg.includes("deadline has passed")) return NextResponse.json({ error: "deadline has passed" }, { status: 422 });
    if (msg.includes("not open")) return NextResponse.json({ error: "bet is not open" }, { status: 422 });
    if (msg.includes("unique constraint") || msg.includes("bet_entries_bet_id_user_id_key")) {
      return NextResponse.json({ error: "already placed a bet" }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Mark anonymous — do this after RPC and check for errors
  if (is_anonymous) {
    const { error: anonError } = await supabase
      .from("bet_entries")
      .update({ is_anonymous: true })
      .eq("bet_id", bet_id)
      .eq("user_id", user.userId);

    if (anonError) {
      return NextResponse.json({ error: "bet placed but failed to mark anonymous — try again" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
