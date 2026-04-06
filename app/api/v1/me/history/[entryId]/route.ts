import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// PATCH /api/v1/me/history/[entryId] — toggle is_hidden_from_profile
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { entryId } = await params;
  const { hidden } = await req.json();
  if (typeof hidden !== "boolean") return NextResponse.json({ error: "hidden must be a boolean" }, { status: 400 });

  // Verify the entry belongs to this user before updating
  const { data: entry } = await supabase
    .from("bet_entries")
    .select("user_id")
    .eq("id", entryId)
    .single();

  if (!entry || entry.user_id !== user.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("bet_entries")
    .update({ is_hidden_from_profile: hidden })
    .eq("id", entryId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hidden });
}
