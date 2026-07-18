import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// DELETE /api/v1/polls/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: poll } = await supabase.from("polls").select("creator_id").eq("id", id).single();
  if (!poll) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (poll.creator_id !== user.userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await supabase.from("polls").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
