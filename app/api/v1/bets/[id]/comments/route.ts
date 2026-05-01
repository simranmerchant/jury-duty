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

  const { id: betId } = await params;

  const { data, error } = await supabase
    .from("bet_comments")
    .select("id, body, created_at, user_id, parent_id, balances(display_name, avatar_url, username), comment_likes(user_id)")
    .eq("bet_id", betId)
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

  const { id: betId } = await params;
  const { body, parentId } = await req.json();

  if (!body?.trim()) return NextResponse.json({ error: "comment required" }, { status: 400 });
  if (body.trim().length > 500) return NextResponse.json({ error: "max 500 chars" }, { status: 400 });

  const insert: Record<string, unknown> = { bet_id: betId, user_id: user.userId, body: body.trim() };
  if (parentId) insert.parent_id = parentId;

  const { data, error } = await supabase
    .from("bet_comments")
    .insert(insert)
    .select("id, body, created_at, user_id, parent_id, balances(display_name, avatar_url, username), comment_likes(user_id)")
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

  const { id: betId } = await params;
  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  const { error } = await supabase
    .from("bet_comments")
    .delete()
    .eq("id", commentId)
    .eq("bet_id", betId)
    .eq("user_id", user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
