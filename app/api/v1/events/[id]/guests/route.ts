import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // Must be host or guest
  const { data: eventMeta } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", id)
    .single();

  if (!eventMeta) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (eventMeta.host_id !== user.userId) {
    const { data: guest } = await supabase
      .from("event_guests")
      .select("user_id")
      .eq("event_id", id)
      .eq("user_id", user.userId)
      .single();
    if (!guest) return NextResponse.json({ error: "not found" }, { status: 404 });
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
