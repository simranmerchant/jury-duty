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

  const { error } = await supabase
    .from("event_last_seen")
    .upsert({ user_id: user.userId, event_id: id, seen_at: new Date().toISOString() }, { onConflict: "user_id,event_id" });

  if (error) console.error("seen upsert failed:", error.message);

  return NextResponse.json({ ok: true });
}
