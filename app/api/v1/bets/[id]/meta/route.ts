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
  const { data: bet } = await supabase
    .from("bets")
    .select("event_id, visibility, bet_invites(user_id), event_guests:events(event_guests(user_id))")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Check access: must be a guest of the event
  const guests = (bet.event_guests as any)?.event_guests ?? [];
  const isGuest = guests.some((g: any) => g.user_id === user.userId);
  if (!isGuest) {
    // For private bets, also allow invited users
    if (bet.visibility === "private") {
      const invited = (bet.bet_invites as any[]).some((i) => i.user_id === user.userId);
      if (!invited) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ event_id: bet.event_id });
}
