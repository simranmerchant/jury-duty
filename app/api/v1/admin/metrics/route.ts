import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: totalBets },
    { count: openBets },
    { count: resolvedBets },
    { count: publicBets },
    { count: followersBets },
    { count: eventBets },
    { count: totalStakes },
    { count: totalComments },
    { count: totalLikes },
    { count: totalFollows },
    { count: totalEvents },
    { count: newUsers30d },
    { count: newUsers7d },
    { count: newBets30d },
    { count: newBets7d },
    { count: newStakes30d },
    { data: creatorRows },
    { data: stakerRows },
    { data: balanceRows },
  ] = await Promise.all([
    supabase.from("balances").select("*", { count: "exact", head: true }),
    supabase.from("bets").select("*", { count: "exact", head: true }),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("audience", "public"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("audience", "followers"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("audience", "event"),
    supabase.from("bet_entries").select("*", { count: "exact", head: true }),
    supabase.from("bet_comments").select("*", { count: "exact", head: true }),
    supabase.from("bet_likes").select("*", { count: "exact", head: true }),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("status", "accepted"),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("balances").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("balances").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabase.from("bets").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("bets").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabase.from("bet_entries").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("bets").select("creator_id"),
    supabase.from("bet_entries").select("user_id"),
    supabase.from("balances").select("points"),
  ]);

  const usersWhoCreatedBets = new Set((creatorRows ?? []).map((r) => r.creator_id)).size;
  const usersWhoStaked = new Set((stakerRows ?? []).map((r) => r.user_id)).size;
  const pts = (balanceRows ?? []).map((r) => r.points ?? 0);
  const avgBalance = pts.length ? Math.round(pts.reduce((s, p) => s + p, 0) / pts.length) : 0;
  const totalPoints = pts.reduce((s, p) => s + p, 0);

  const now = new Date();
  const generatedAt = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const metrics: Record<string, number | string> = {
    // Users
    "Total Registered Users": totalUsers ?? 0,
    "Users Who Created a Bet": usersWhoCreatedBets,
    "Users Who Voted on a Bet": usersWhoStaked,
    "New Users (Last 7 Days)": newUsers7d ?? 0,
    "New Users (Last 30 Days)": newUsers30d ?? 0,

    // Bets
    "Total Predictions Created": totalBets ?? 0,
    "Currently Open Predictions": openBets ?? 0,
    "Resolved Predictions": resolvedBets ?? 0,
    "Predictions in Events & Groups": eventBets ?? 0,
    "Predictions Shared to Feed (followers)": followersBets ?? 0,
    "Predictions on Explore (public)": publicBets ?? 0,
    "New Predictions (Last 7 Days)": newBets7d ?? 0,
    "New Predictions (Last 30 Days)": newBets30d ?? 0,

    // Engagement
    "Total Votes Cast": totalStakes ?? 0,
    "New Votes (Last 30 Days)": newStakes30d ?? 0,
    "Total Comments": totalComments ?? 0,
    "Total Likes": totalLikes ?? 0,
    "Total Follows (accepted)": totalFollows ?? 0,
    "Total Events & Groups": totalEvents ?? 0,

    // Points economy
    "Avg Points Balance per User": avgBalance,
    "Total Points in Circulation": totalPoints,

    // Meta
    "Report Generated": generatedAt,
  };

  return NextResponse.json({ metrics });
}
