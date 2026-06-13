import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "app_staging_placeholder";
const WORLD_ACTION = "verify-human";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { proof, merkle_root, nullifier_hash, verification_level } = await req.json();
  if (!proof || !nullifier_hash) return NextResponse.json({ error: "missing proof" }, { status: 400 });

  // Check nullifier not already used
  const { data: existing } = await supabase
    .from("balances")
    .select("user_id")
    .eq("world_nullifier_hash", nullifier_hash)
    .maybeSingle();

  if (existing && existing.user_id !== user.userId) {
    return NextResponse.json({ error: "this World ID is already linked to another account" }, { status: 409 });
  }

  // Verify proof with World ID Developer Portal
  const verifyRes = await fetch(`https://developer.worldcoin.org/api/v2/verify/${WORLD_APP_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nullifier_hash, merkle_root, proof, verification_level, action: WORLD_ACTION }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    return NextResponse.json({ error: (err as any).detail ?? "verification failed" }, { status: 400 });
  }

  const { error } = await supabase
    .from("balances")
    .update({ world_verified: true, world_nullifier_hash: nullifier_hash })
    .eq("user_id", user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, verified: true });
}
