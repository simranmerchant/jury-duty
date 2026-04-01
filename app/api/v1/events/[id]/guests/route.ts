import { NextRequest, NextResponse } from "next/server";
import { requireUser, privy } from "@/lib/privy";
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

  // Must be a guest or host of this event
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
    .select("user_id")
    .eq("event_id", id);

  const guestIds = guestRows?.map((g) => g.user_id) ?? [];

  // Fetch phone info from Privy for each guest (masked)
  const guests = await Promise.all(
    guestIds.map(async (userId) => {
      try {
        const privyUser = await privy.getUser(userId);
        const phoneAccount = privyUser.linkedAccounts.find(
          (a: any) => a.type === "phone"
        );
        const phone = phoneAccount?.phoneNumber as string | undefined;
        const label = phone ? `···${phone.slice(-4)}` : userId.slice(-6);
        return { userId, label };
      } catch {
        return { userId, label: userId.slice(-6) };
      }
    })
  );

  // Exclude the requesting user (you don't invite yourself)
  const others = guests.filter((g) => g.userId !== user.userId);

  return NextResponse.json({ guests: others });
}
