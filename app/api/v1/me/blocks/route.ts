import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { notifyAdmin } from "@/lib/notify-admin";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", user.userId);

  return NextResponse.json({ blocked_ids: (data ?? []).map((r) => r.blocked_id) });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { blocked_id } = await req.json();
  if (!blocked_id) return NextResponse.json({ error: "blocked_id required" }, { status: 400 });
  if (blocked_id === user.userId) return NextResponse.json({ error: "cannot block yourself" }, { status: 400 });

  const { error } = await supabase
    .from("blocked_users")
    .upsert({ blocker_id: user.userId, blocked_id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyAdmin(
    `[jury duty] user blocked`,
    `Blocker: ${user.userId}\nBlocked: ${blocked_id}`
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const blocked_id = req.nextUrl.searchParams.get("userId");
  if (!blocked_id) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await supabase.from("blocked_users").delete().eq("blocker_id", user.userId).eq("blocked_id", blocked_id);

  return NextResponse.json({ ok: true });
}
