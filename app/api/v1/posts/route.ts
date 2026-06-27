import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/posts — share a resolved public bet to your followers' feed
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { bet_id, caption } = body;

  if (!bet_id) return NextResponse.json({ error: "bet_id required" }, { status: 400 });
  if (caption && caption.length > 280) return NextResponse.json({ error: "caption too long" }, { status: 400 });

  // Validate bet: must exist, be resolved, and be public
  const { data: bet } = await supabase
    .from("bets")
    .select("id, status, visibility, creator_id")
    .eq("id", bet_id)
    .single();

  if (!bet) return NextResponse.json({ error: "bet not found" }, { status: 404 });
  if (bet.status !== "resolved") return NextResponse.json({ error: "only resolved bets can be shared" }, { status: 400 });
  if (bet.visibility === "private") return NextResponse.json({ error: "private bets cannot be shared" }, { status: 403 });

  // User must have participated in or created the bet
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

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ user_id: user.userId, bet_id, caption: caption?.trim() || null })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "already shared" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: post.id });
}

// DELETE /api/v1/posts?bet_id=... — unshare a bet
export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bet_id = new URL(req.url).searchParams.get("bet_id");
  if (!bet_id) return NextResponse.json({ error: "bet_id required" }, { status: 400 });

  await supabase.from("posts").delete().eq("user_id", user.userId).eq("bet_id", bet_id);

  return NextResponse.json({ ok: true });
}
