import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/polls — create a standalone poll
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { question, option_a, option_b, closes_at, event_id } = body;

  if (!question?.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });
  if (!option_a?.trim()) return NextResponse.json({ error: "option_a required" }, { status: 400 });
  if (!option_b?.trim()) return NextResponse.json({ error: "option_b required" }, { status: 400 });

  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      creator_id: user.userId,
      question: question.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      closes_at: closes_at ?? null,
      event_id: event_id ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pollId: poll.id });
}
