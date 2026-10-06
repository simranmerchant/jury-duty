import { NextRequest, NextResponse } from "next/server";

const SHEET_WEBHOOK = process.env.PLAY_SHEET_WEBHOOK_URL;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, username, category, screenshot, caption } = body;

  if (!name || !username || !category || !screenshot) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  if (SHEET_WEBHOOK) {
    try {
      await fetch(SHEET_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          category,
          screenshot,
          caption: caption ?? "",
          submitted_at: new Date().toISOString(),
        }),
      });
    } catch {
      // log but don't fail the user
      console.error("sheet webhook failed");
    }
  }

  return NextResponse.json({ ok: true });
}
