import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { buildBetInviteUrl, isFeedBetAudience } from "@/lib/bet-invite";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://juryduty.xyz";

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
    .select("id, creator_id, invite_token, audience")
    .eq("id", id)
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (bet.creator_id !== user.userId) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  if (!isFeedBetAudience((bet as any).audience)) return NextResponse.json({ error: "only available for feed bets" }, { status: 400 });

  let inviteToken = (bet as any).invite_token as string | null;
  if (!inviteToken) {
    inviteToken = crypto.randomUUID();
    await supabase.from("bets").update({ invite_token: inviteToken }).eq("id", id);
  }

  return NextResponse.json({ url: buildBetInviteUrl(inviteToken, BASE_URL) });
}
