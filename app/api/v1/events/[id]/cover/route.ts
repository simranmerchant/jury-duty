import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { uploadToWalrus } from "@/lib/walrus";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (event.host_id !== user.userId) return NextResponse.json({ error: "only the host can set the cover" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "must be an image" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "max 5MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ts = Date.now();
  const path = `${id}.jpg`;

  let coverUrl: string;
  try {
    coverUrl = await uploadToWalrus(buffer, "image/jpeg");
  } catch {
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const { data: { publicUrl } } = supabase.storage.from("covers").getPublicUrl(path);
    coverUrl = `${publicUrl}?t=${ts}`;
  }

  // Also store the original (uncropped) when provided as a separate field
  const originalFile = formData.get("original") as File | null;
  let coverOriginalUrl: string | null = null;
  if (originalFile && originalFile.type.startsWith("image/")) {
    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());
    try {
      coverOriginalUrl = await uploadToWalrus(originalBuffer, "image/jpeg");
    } catch {
      const originalPath = `originals/${id}.jpg`;
      const { error: origError } = await supabase.storage
        .from("covers")
        .upload(originalPath, originalBuffer, { contentType: "image/jpeg", upsert: true });
      if (!origError) {
        const { data: { publicUrl: origPub } } = supabase.storage.from("covers").getPublicUrl(originalPath);
        coverOriginalUrl = `${origPub}?t=${ts}`;
      }
    }
  }

  const updates: Record<string, string> = { cover_url: coverUrl };
  if (coverOriginalUrl) updates.cover_original_url = coverOriginalUrl;

  const { error: updateError } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ cover_url: coverUrl, cover_original_url: coverOriginalUrl });
}
