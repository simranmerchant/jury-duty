import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { validateTopic, buildTopicBetCounts } from "@/lib/topics";

// GET /api/v1/topics — list all topics with bet counts
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: topics, error } = await supabase
    .from("topics")
    .select("id, name, emoji, description, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get bet counts per topic in one query
  const { data: counts } = await supabase
    .from("explore_bets")
    .select("topic_id")
    .not("topic_id", "is", null);

  const countMap = buildTopicBetCounts(counts ?? []);

  return NextResponse.json({
    topics: (topics ?? []).map((t) => ({ ...t, bet_count: countMap[t.id] ?? 0 })),
  });
}

// POST /api/v1/topics — create a new topic (creator only for now)
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, emoji, description } = await req.json().catch(() => ({}));
  const validationError = validateTopic({ name, emoji, description });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { data, error } = await supabase
    .from("topics")
    .insert({ name: name.trim(), emoji: emoji ?? null, description: description ?? null })
    .select("id, name, emoji, description, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ topic: data }, { status: 201 });
}
