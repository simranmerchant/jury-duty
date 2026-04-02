import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { points } = await req.json();

  if (typeof points !== "number" || points <= 0) {
    return NextResponse.json({ error: "points must be a positive number" }, { status: 400 });
  }

  const { error } = await supabase.rpc("double_down", {
    p_user_id: user.userId,
    p_bet_id: id,
    p_points: points,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("insufficient balance")) return NextResponse.json({ error: "not enough points" }, { status: 422 });
    if (msg.includes("deadline has passed")) return NextResponse.json({ error: "deadline has passed" }, { status: 422 });
    if (msg.includes("not open")) return NextResponse.json({ error: "bet is not open" }, { status: 422 });
    if (msg.includes("no existing bet")) return NextResponse.json({ error: "you haven't bet on this yet" }, { status: 422 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
