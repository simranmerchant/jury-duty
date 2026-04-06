import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await requireUser(authToken).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token || typeof token !== "string") return NextResponse.json({ error: "token required" }, { status: 400 });

  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: user.userId, token, platform: "expo", updated_at: new Date().toISOString() },
    { onConflict: "user_id,token" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
