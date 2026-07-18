import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// POST /api/v1/events/[id]/polls — create a poll inside an event/group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: eventId } = await params;

  // Verify user is a guest (or host) of the event
  const { data: event } = await supabase
    .from("events")
    .select("id, host_id")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });

  if (event.host_id !== user.userId) {
    const { data: guest } = await supabase
      .from("event_guests")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("user_id", user.userId)
      .single();

    if (!guest) return NextResponse.json({ error: "not a guest of this event" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { question, option_a, option_b, closes_at } = body;

  if (!question?.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });
  if (question.trim().length > 200) return NextResponse.json({ error: "question too long" }, { status: 400 });
  if (!option_a?.trim()) return NextResponse.json({ error: "option_a required" }, { status: 400 });
  if (!option_b?.trim()) return NextResponse.json({ error: "option_b required" }, { status: 400 });
  if (option_a.trim().length > 80) return NextResponse.json({ error: "option_a too long" }, { status: 400 });
  if (option_b.trim().length > 80) return NextResponse.json({ error: "option_b too long" }, { status: 400 });
  if (closes_at && new Date(closes_at) <= new Date()) {
    return NextResponse.json({ error: "closes_at must be in the future" }, { status: 400 });
  }

  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      question: question.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      creator_id: user.userId,
      event_id: eventId,
      closes_at: closes_at ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pollId: poll.id }, { status: 201 });
}
