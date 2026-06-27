import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, body, created_at, user_id, balances:user_id(display_name, avatar_url, username)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const { body } = await req.json().catch(() => ({}));

  if (!body?.trim()) return NextResponse.json({ error: "comment required" }, { status: 400 });
  if (body.trim().length > 500) return NextResponse.json({ error: "max 500 chars" }, { status: 400 });

  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: user.userId, body: body.trim() })
    .select("id, body, created_at, user_id, balances:user_id(display_name, avatar_url, username)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("post_id", postId)
    .eq("user_id", user.userId);

  return NextResponse.json({ ok: true });
}
