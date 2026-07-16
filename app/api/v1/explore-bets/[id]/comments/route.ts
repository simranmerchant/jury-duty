import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// GET /api/v1/explore-bets/[id]/comments — list comments oldest-first
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: raw, error } = await supabase
    .from("explore_bet_comments")
    .select(`id, body, created_at, user_id, user:user_id(display_name, username, avatar_url)`)
    .eq("explore_bet_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comments = (raw ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    is_mine: c.user_id === user.userId,
    user: (c.user as any) ?? null,
  }));

  return NextResponse.json({ comments });
}

// POST /api/v1/explore-bets/[id]/comments — add a comment
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
  const { text } = body;

  if (!text?.trim()) return NextResponse.json({ error: "comment cannot be empty" }, { status: 400 });
  if (text.trim().length > 500) return NextResponse.json({ error: "comment too long" }, { status: 400 });

  const { data: bet } = await supabase
    .from("explore_bets")
    .select("id")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: comment, error } = await supabase
    .from("explore_bet_comments")
    .insert({ explore_bet_id: id, user_id: user.userId, body: text.trim() })
    .select("id, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment }, { status: 201 });
}
