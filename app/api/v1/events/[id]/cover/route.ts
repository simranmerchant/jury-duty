import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
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
  if (event.host_id !== user.userId) return NextResponse.json({ error: "only the host can set the cover" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "must be an image" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "max 5MB" }, { status: 400 });

  const path = `${id}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("covers")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from("covers").getPublicUrl(path);
  const coverUrl = `${publicUrl}?t=${Date.now()}`;

  await supabase.from("events").update({ cover_url: coverUrl }).eq("id", id);

  return NextResponse.json({ cover_url: coverUrl });
}
