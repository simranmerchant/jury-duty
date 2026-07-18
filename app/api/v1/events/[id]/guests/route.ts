import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

async function assertMember(eventId: string, userId: string): Promise<boolean> {
  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();

  if (!event) return false;
  if (event.host_id === userId) return true;

  const { data: guest } = await supabase
    .from("event_guests")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  return !!guest;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!(await assertMember(id, user.userId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: guestRows } = await supabase
    .from("event_guests")
    .select("user_id, balances(display_name)")
    .eq("event_id", id)
    .neq("user_id", user.userId);

  const guests = (guestRows ?? []).map((g: any) => ({
    userId: g.user_id,
    label: g.balances?.display_name ?? "guest",
  }));

  return NextResponse.json({ guests });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  if (!(await assertMember(id, user.userId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { userIds } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  const rows = userIds.map((uid: string) => ({ event_id: id, user_id: uid }));
  const { error } = await supabase
    .from("event_guests")
    .upsert(rows, { onConflict: "event_id,user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
