import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isImage && !isVideo) return NextResponse.json({ error: "must be an image or video" }, { status: 400 });

  const maxBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ error: isVideo ? "max 100MB for video" : "max 10MB" }, { status: 400 });

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? (isVideo ? "mp4" : "jpg");
  const path = `${user.userId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("post-photos")
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from("post-photos").getPublicUrl(path);
  return NextResponse.json(isVideo ? { video_url: publicUrl } : { photo_url: publicUrl });
}
