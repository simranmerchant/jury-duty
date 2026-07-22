import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { validateBetJoinBody, isFeedBetAudience } from "@/lib/bet-invite";

// Public: fetch bet preview by invite token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const { data: bet } = await supabase
    .from("bets")
    .select(`
      id, question, deadline, status,
      balances:creator_id(display_name, avatar_url),
      bet_entries(id)
    `)
    .eq("invite_token", token)
    .eq("audience", "followers")
    .single();

  if (!bet) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    bet: {
      id: bet.id,
      question: bet.question,
      deadline: bet.deadline,
      status: bet.status,
      creator_name: (bet.balances as any)?.display_name ?? "someone",
      creator_avatar: (bet.balances as any)?.avatar_url ?? null,
      entry_count: (bet.bet_entries as any[]).length,
    },
  });
}

// Authenticated: accept bet invite, add to bet_invites
export async function POST(req: NextRequest) {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(authToken).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const validationError = validateBetJoinBody(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { invite_token } = body as { invite_token: string };

  const { data: bet } = await supabase
    .from("bets")
    .select("id, audience")
    .eq("invite_token", invite_token)
    .single();

  if (!bet || !isFeedBetAudience((bet as any).audience)) return NextResponse.json({ error: "invalid invite link" }, { status: 404 });

  const { error } = await supabase
    .from("bet_invites")
    .upsert({ bet_id: bet.id, user_id: user.userId }, { onConflict: "bet_id,user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ betId: bet.id });
}
