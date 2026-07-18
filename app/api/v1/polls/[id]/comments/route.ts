import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/polls/[id]/comments
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: comments, error } = await supabase
    .from("poll_comments")
    .select("id, body, created_at, balances:user_id(display_name, avatar_url, username)")
    .eq("poll_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comments: comments ?? [] });
}

// POST /api/v1/polls/[id]/comments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { body: text } = body;

  if (!text?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "comment too long" }, { status: 400 });

  const { data: poll } = await supabase.from("polls").select("id").eq("id", id).single();
  if (!poll) return NextResponse.json({ error: "poll not found" }, { status: 404 });

  const { data: comment, error } = await supabase
    .from("poll_comments")
    .insert({ poll_id: id, user_id: user.userId, body: text.trim() })
    .select("id, body, created_at, balances:user_id(display_name, avatar_url, username)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment });
}
