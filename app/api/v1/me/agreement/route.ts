import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await supabase
    .from("user_agreements")
    .upsert({ user_id: user.userId, agreed_at: new Date().toISOString(), version: "v1" }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
