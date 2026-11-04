import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

  // Allow host or any guest to upload a cover photo
  if (event.host_id !== user.userId) {
    const { data: guest } = await supabase
      .from("event_guests")
      .select("user_id")
      .eq("event_id", id)
      .eq("user_id", user.userId)
      .single();
    if (!guest) return NextResponse.json({ error: "must be a member of this group" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const originalFile = formData.get("original") as File | null;

  if (!file && !originalFile) return NextResponse.json({ error: "no file" }, { status: 400 });

  const ts = Date.now();
  const updates: Record<string, string> = {};

  if (file) {
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "must be an image" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "max 5MB" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const { data: { publicUrl } } = supabase.storage.from("covers").getPublicUrl(path);
    updates.cover_url = `${publicUrl}?t=${ts}`;
  }

  if (originalFile && originalFile.type.startsWith("image/")) {
    const originalPath = `originals/${id}.jpg`;
    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());
    const { error: origError } = await supabase.storage
      .from("covers")
      .upload(originalPath, originalBuffer, { contentType: "image/jpeg", upsert: true });
    if (!origError) {
      const { data: { publicUrl: origPub } } = supabase.storage.from("covers").getPublicUrl(originalPath);
      updates.cover_original_url = `${origPub}?t=${ts}`;
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "no valid files" }, { status: 400 });

  const { error: updateError } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ cover_url: updates.cover_url ?? null, cover_original_url: updates.cover_original_url ?? null });
}
