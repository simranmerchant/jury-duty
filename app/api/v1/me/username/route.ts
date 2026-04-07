import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { USERNAME_RE } from "@/lib/username";

// GET /api/v1/me/username?u=somehandle — availability check, no auth required
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u")?.toLowerCase().trim();
  if (!u) return NextResponse.json({ error: "missing u param" }, { status: 400 });

  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({ available: false, reason: "3–20 chars, letters/numbers/._only, can't start or end with . or _" });
  }

  const { data } = await supabase
    .from("balances")
    .select("user_id")
    .eq("username", u)
    .single();

  return NextResponse.json({ available: !data });
}

// PATCH /api/v1/me/username — claim or change username
export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { username } = await req.json();
  const u = username?.toLowerCase().trim();

  if (!u || !USERNAME_RE.test(u)) {
    return NextResponse.json({ error: "3–20 chars, letters/numbers/. and _ only, can't start or end with . or _" }, { status: 400 });
  }

  // Check if already taken by someone else
  const { data: existing } = await supabase
    .from("balances")
    .select("user_id")
    .eq("username", u)
    .single();

  if (existing && existing.user_id !== user.userId) {
    return NextResponse.json({ error: "username taken" }, { status: 409 });
  }

  const { error } = await supabase
    .from("balances")
    .update({ username: u })
    .eq("user_id", user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ username: u });
}
