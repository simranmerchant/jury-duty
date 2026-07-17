import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/polls/[id]/post — share poll to feed (all followers or specific users)
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
  if (targeted_user_ids !== undefined && !Array.isArray(targeted_user_ids))
    return NextResponse.json({ error: "targeted_user_ids must be an array" }, { status: 400 });

  const { data: poll } = await supabase
    .from("polls")
    .select("id")
    .eq("id", id)
    .single();

  if (!poll) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase
    .from("poll_posts")
    .insert({
      poll_id: id,
      user_id: user.userId,
      caption: caption?.trim() || null,
      photo_url: photo_url || null,
      targeted_user_ids: targeted_user_ids?.length ? targeted_user_ids : null,
    });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "already posted" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/v1/polls/[id]/post — unshare poll from feed
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
    .from("poll_posts")
    .delete()
    .eq("poll_id", id)
    .eq("user_id", user.userId);

  return NextResponse.json({ ok: true });
}
