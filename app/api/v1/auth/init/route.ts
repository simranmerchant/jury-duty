import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Called on first login to create the user's balance row.
// For Supabase Auth users: bridges phone → old Privy user_id if this is their first login.
// Safe to call multiple times — does nothing if the row already exists.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let verifyError: string | null = null;
  const user = await requireUser(token).catch((e: any) => { verifyError = e?.message ?? String(e); return null; });
  if (!user) return NextResponse.json({ error: "unauthorized", detail: verifyError }, { status: 401 });

  // For Supabase Auth users: migrate from old Privy ID via phone match.
  if (user.provider === "supabase") {
    const { data: authUser } = await supabase.auth.admin.getUserById(user.userId);
    const phone = authUser?.user?.phone;
    if (phone) {
      const { data: existing } = await supabase
        .from("balances")
        .select("user_id")
        .eq("phone", phone)
        .neq("user_id", user.userId)
        .maybeSingle();

      if (existing?.user_id) {
        await supabase.rpc("migrate_user_id", {
          old_id: existing.user_id,
          new_id: user.userId,
        });
      }
    }
  }

  // Single round-trip: insert-or-ignore + select in one SQL function.
  const { data, error } = await (supabase as any).rpc("init_user", { p_user_id: user.userId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    userId: user.userId,
    points: row?.points ?? 300,
    hasName: !!row?.display_name,
    hasUsername: !!row?.username,
  });
}
