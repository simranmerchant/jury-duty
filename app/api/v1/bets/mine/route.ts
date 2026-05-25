import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Fetch standalone bets where user is creator or invited
  const [{ data: created }, { data: invited }] = await Promise.all([
    supabase
      .from("bets")
      .select(`
        id, question, deadline, status, visibility, winning_option_id, creator_id, created_at, invite_token,
        bet_options(id, label),
        bet_entries(id, user_id, option_id, points_staked, is_anonymous),
        balances!bets_creator_id_fkey(display_name, avatar_url, username)
      `)
      .is("event_id", null)
      .eq("creator_id", user.userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bet_invites")
      .select(`
        bets!inner(
          id, question, deadline, status, visibility, winning_option_id, creator_id, created_at, invite_token,
          bet_options(id, label),
          bet_entries(id, user_id, option_id, points_staked, is_anonymous),
          balances!bets_creator_id_fkey(display_name, avatar_url, username)
        )
      `)
      .is("bets.event_id", null)
      .eq("user_id", user.userId)
      .neq("bets.creator_id", user.userId),
  ]);

  const createdBets = (created ?? []);
  const invitedBets = ((invited ?? []) as any[]).map((r: any) => r.bets).filter(Boolean);

  // Merge, dedup by id, sort by created_at desc
  const seen = new Set<string>();
  const bets = [...createdBets, ...invitedBets]
    .filter((b: any) => { if (seen.has(b.id)) return false; seen.add(b.id); return true; })
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ bets });
}
