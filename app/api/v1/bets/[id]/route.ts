import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: bet } = await supabase
    .from("bets")
    .select("creator_id, event_id, events(host_id)")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isCreator = bet.creator_id === user.userId;
  const isHost = (bet.events as any)?.host_id === user.userId;
  if (!isCreator && !isHost) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { error } = await supabase.from("bets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
