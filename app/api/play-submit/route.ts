import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SHEET_WEBHOOK = process.env.PLAY_SHEET_WEBHOOK_URL;
const BUCKET = "competition-entries";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const name = formData.get("name") as string;
  const username = formData.get("username") as string;
  const category = formData.get("category") as string;
  const caption = (formData.get("caption") as string) ?? "";
  const file = formData.get("screenshot") as File | null;

  if (!name || !username || !category || !file) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "file must be an image" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "image must be under 10MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("storage upload failed", uploadError);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const screenshotUrl = urlData.publicUrl;

  if (SHEET_WEBHOOK) {
    try {
      await fetch(SHEET_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          category,
          screenshot: screenshotUrl,
          caption,
          submitted_at: new Date().toISOString(),
        }),
      });
    } catch {
      console.error("sheet webhook failed");
    }
  }

  return NextResponse.json({ ok: true });
}
