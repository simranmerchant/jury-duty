import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "leaderboard removed" }, { status: 404 });
}
