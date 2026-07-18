import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/explore-bets/[id]/post — share a caption on an explore bet card
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { caption, photo_url, targeted_user_ids } = body;

  if (caption && caption.length > 280) return NextResponse.json({ error: "caption too long" }, { status: 400 });

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.status !== "resolved") return NextResponse.json({ error: "prediction must be resolved before sharing" }, { status: 422 });

  const { data: post, error } = await supabase
    .from("explore_bet_posts")
    .insert({
      explore_bet_id: id,
      user_id: user.userId,
      caption: caption?.trim() || null,
      photo_url: photo_url ?? null,
      targeted_user_ids: Array.isArray(targeted_user_ids) && targeted_user_ids.length > 0 ? targeted_user_ids : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "already posted" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: post.id }, { status: 201 });
}

// DELETE /api/v1/explore-bets/[id]/post — remove your post from this explore bet
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  await supabase
    .from("explore_bet_posts")
    .delete()
    .eq("explore_bet_id", id)
    .eq("user_id", user.userId);

  return NextResponse.json({ ok: true });
}
