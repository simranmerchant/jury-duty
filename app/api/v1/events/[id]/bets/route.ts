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

  const { id: eventId } = await params;

  // Must be a guest of this event
  const { data: guest } = await supabase
    .from("event_guests")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", user.userId)
    .single();

  if (!guest) return NextResponse.json({ error: "not a guest of this event" }, { status: 403 });

  // Event must still be open
  const { data: event } = await supabase
    .from("events")
    .select("ends_at")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });
  if (new Date(event.ends_at) < new Date()) {
    return NextResponse.json({ error: "event is closed" }, { status: 422 });
  }

  const { question, options, deadline, visibility } = await req.json();

  if (!question?.trim() || question.trim().length > 200) {
    return NextResponse.json({ error: "question required (max 200 chars)" }, { status: 400 });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "at least 2 options required" }, { status: 400 });
  }
  if (options.some((o: string) => !o?.trim() || o.trim().length > 100)) {
    return NextResponse.json({ error: "each option must be 1-100 chars" }, { status: 400 });
  }
  if (!deadline) return NextResponse.json({ error: "deadline required" }, { status: 400 });
  if (new Date(deadline) <= new Date()) {
    return NextResponse.json({ error: "deadline must be in the future" }, { status: 400 });
  }
  if (visibility && !["public", "private"].includes(visibility)) {
    return NextResponse.json({ error: "invalid visibility" }, { status: 400 });
  }

  // Insert bet
  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      event_id: eventId,
      creator_id: user.userId,
      question: question.trim(),
      deadline,
      visibility: visibility ?? "public",
    })
    .select("id")
    .single();

  if (betError || !bet) return NextResponse.json({ error: betError?.message ?? "failed" }, { status: 500 });

  // Insert options
  const { error: optError } = await supabase
    .from("bet_options")
    .insert(options.map((label: string) => ({ bet_id: bet.id, label: label.trim() })));

  if (optError) return NextResponse.json({ error: optError.message }, { status: 500 });

  return NextResponse.json({ betId: bet.id }, { status: 201 });
}
