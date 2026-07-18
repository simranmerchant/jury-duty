import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/polls/[id]/vote — cast or change a vote
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { side } = body;

  if (side !== "a" && side !== "b") return NextResponse.json({ error: "side must be 'a' or 'b'" }, { status: 400 });

  const { data: poll } = await supabase.from("polls").select("id, closes_at").eq("id", id).single();
  if (!poll) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (poll.closes_at && new Date(poll.closes_at) < new Date()) {
    return NextResponse.json({ error: "poll is closed" }, { status: 400 });
  }

  await supabase
    .from("poll_votes")
    .upsert({ poll_id: id, user_id: user.userId, side }, { onConflict: "poll_id,user_id" });

  const { data: votes } = await supabase.from("poll_votes").select("side").eq("poll_id", id);
  const votes_a = (votes ?? []).filter((v) => v.side === "a").length;
  const votes_b = (votes ?? []).filter((v) => v.side === "b").length;

  return NextResponse.json({ votes_a, votes_b, side });
}
