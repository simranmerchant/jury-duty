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

  const { id: betId } = await params;
  const { winning_option_id } = await req.json();

  // winning_option_id = null means no winner — refund all
  const { error } = await supabase.rpc("resolve_bet", {
    p_resolver_id: user.userId,
    p_bet_id: betId,
    p_winning_option_id: winning_option_id ?? null,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("already resolved")) return NextResponse.json({ error: "already resolved" }, { status: 422 });
    if (msg.includes("not authorized")) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
