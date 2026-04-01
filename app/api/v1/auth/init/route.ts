import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// Called on first login to create the user's balance row.
// Safe to call multiple times — does nothing if the row already exists.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("balances")
    .upsert({ user_id: user.userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await supabase
    .from("balances")
    .select("points, display_name")
    .eq("user_id", user.userId)
    .single();

  return NextResponse.json({
    userId: user.userId,
    points: data?.points ?? 1000,
    hasName: !!data?.display_name,
  });
}
