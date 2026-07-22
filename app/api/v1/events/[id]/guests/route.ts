import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

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

  // Find which userIds are genuinely new (not already guests)
  const [existingRes, eventRes, adderRes] = await Promise.all([
    supabase.from("event_guests").select("user_id").eq("event_id", id).in("user_id", userIds),
    supabase.from("events").select("name, type").eq("id", id).single(),
    supabase.from("balances").select("display_name, username").eq("user_id", user.userId).single(),
  ]);

  const alreadyIn = new Set((existingRes.data ?? []).map((r: any) => r.user_id));
  const newUserIds = userIds.filter((uid: string) => !alreadyIn.has(uid) && uid !== user.userId);

  const rows = userIds.map((uid: string) => ({ event_id: id, user_id: uid }));
  const { error } = await supabase
    .from("event_guests")
    .upsert(rows, { onConflict: "event_id,user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (newUserIds.length > 0 && eventRes.data) {
    const adderName = adderRes.data?.display_name ?? adderRes.data?.username ?? "someone";
    const eventName = eventRes.data.name;
    const eventType = eventRes.data.type === "group" ? "group" : "event";
    const notifTitle = `${adderName} added you to "${eventName}"`;
    const notifBody = `you've been added to a ${eventType}`;
    const notifData = { event_id: id };

    await Promise.all([
      supabase.from("notifications").insert(
        newUserIds.map((uid: string) => ({
          user_id: uid,
          type: "event_added",
          title: notifTitle,
          body: notifBody,
          data: notifData,
        }))
      ),
      sendPushToUsers(newUserIds, { title: notifTitle, body: notifBody, data: notifData }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
