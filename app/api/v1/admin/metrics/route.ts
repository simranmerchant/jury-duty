import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function groupByDay(rows: { created_at: string }[], days: number): Record<string, number> {
  const counts: Record<string, number> = {};
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    const d = new Date(row.created_at);
    if (d.getTime() < cutoff) continue;
    const key = d.toISOString().slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function fillDays(counts: Record<string, number>, days: number): { date: string; count: number }[] {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: counts[key] ?? 0 });
  }
  return result;
}

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
    { count: followersBets },
    { count: eventBets },
    { count: totalStakes },
    { count: totalComments },
    { count: betLikes },
    { count: postLikes },
    { count: pollLikes },
    { count: commentLikes },
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
    { data: dailyUserRows },
    { data: dailyBetRows },
    { data: dailyVoteRows },
  ] = await Promise.all([
    supabase.from("balances").select("*", { count: "exact", head: true }),
    supabase.from("bets").select("*", { count: "exact", head: true }),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("audience", "followers"),
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("audience", "event"),
    supabase.from("bet_entries").select("*", { count: "exact", head: true }),
    supabase.from("bet_comments").select("*", { count: "exact", head: true }),
    supabase.from("bet_likes").select("*", { count: "exact", head: true }),
    supabase.from("post_likes").select("*", { count: "exact", head: true }),
    supabase.from("poll_likes").select("*", { count: "exact", head: true }),
    supabase.from("comment_likes").select("*", { count: "exact", head: true }),
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
    supabase.from("balances").select("created_at").gte("created_at", thirtyDaysAgo),
    supabase.from("bets").select("created_at").gte("created_at", thirtyDaysAgo),
    supabase.from("bet_entries").select("created_at").gte("created_at", thirtyDaysAgo),
  ]);

  const usersWhoCreatedBets = new Set((creatorRows ?? []).map((r) => r.creator_id)).size;
  const usersWhoStaked = new Set((stakerRows ?? []).map((r) => r.user_id)).size;
  const pts = (balanceRows ?? []).map((r) => r.points ?? 0);
  const avgBalance = pts.length ? Math.round(pts.reduce((s, p) => s + p, 0) / pts.length) : 0;
  const totalPoints = pts.reduce((s, p) => s + p, 0);

  const daily = fillDays({}, 30).map(({ date }) => ({
    date,
    new_users: groupByDay(dailyUserRows ?? [], 30)[date] ?? 0,
    new_predictions: groupByDay(dailyBetRows ?? [], 30)[date] ?? 0,
    new_votes: groupByDay(dailyVoteRows ?? [], 30)[date] ?? 0,
  }));

  const now = new Date();
  const generatedAt = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const metrics: Record<string, number | string> = {
    "Total Registered Users": totalUsers ?? 0,
    "Users Who Created a Bet": usersWhoCreatedBets,
    "Users Who Voted on a Bet": usersWhoStaked,
    "New Users (Last 7 Days)": newUsers7d ?? 0,
    "New Users (Last 30 Days)": newUsers30d ?? 0,
    "Total Predictions Created": totalBets ?? 0,
    "Currently Open Predictions": openBets ?? 0,
    "Resolved Predictions": resolvedBets ?? 0,
    "Predictions in Events & Groups": eventBets ?? 0,
    "Predictions Shared to Feed (followers)": followersBets ?? 0,
    "New Predictions (Last 7 Days)": newBets7d ?? 0,
    "New Predictions (Last 30 Days)": newBets30d ?? 0,
    "Total Votes Cast": totalStakes ?? 0,
    "New Votes (Last 30 Days)": newStakes30d ?? 0,
    "Total Comments": totalComments ?? 0,
    "Likes on Predictions": betLikes ?? 0,
    "Likes on Posts": postLikes ?? 0,
    "Likes on Polls": pollLikes ?? 0,
    "Likes on Comments": commentLikes ?? 0,
    "Total Follows (accepted)": totalFollows ?? 0,
    "Total Events & Groups": totalEvents ?? 0,
    "Avg Points Balance per User": avgBalance,
    "Total Points in Circulation": totalPoints,
    "Report Generated": generatedAt,
  };

  return NextResponse.json({ metrics, daily });
}
