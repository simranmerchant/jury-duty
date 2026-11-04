import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "double-down removed" }, { status: 404 });
}
