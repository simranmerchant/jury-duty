import { NextRequest, NextResponse } from "next/server";
import { requireUser, privy } from "@/lib/privy";
import { supabase } from "@/lib/supabase";

// Called on first login to create the user's balance row.
// Safe to call multiple times — does nothing if the row already exists.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let verifyError: string | null = null;
  const user = await requireUser(token).catch((e: any) => { verifyError = e?.message ?? String(e); return null; });
  if (!user) return NextResponse.json({ error: "unauthorized", detail: verifyError }, { status: 401 });

  const { error } = await supabase
    .from("balances")
    .upsert({ user_id: user.userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull linked phone from Privy and store it for contact matching.
  // Fire-and-forget — don't block the response if this fails.
  privy.getUser(user.userId).then((privyUser) => {
    const phoneAccount = privyUser.linkedAccounts?.find((a: any) => a.type === "phone");
    if (phoneAccount?.phoneNumber) {
      supabase
        .from("balances")
        .update({ phone: phoneAccount.phoneNumber })
        .eq("user_id", user.userId)
        .then(() => {});
    }
  }).catch(() => {});

  const { data } = await supabase
    .from("balances")
    .select("points, display_name, username")
    .eq("user_id", user.userId)
    .single();

  return NextResponse.json({
    userId: user.userId,
    points: data?.points ?? 300,
    hasName: !!data?.display_name,
    hasUsername: !!data?.username,
  });
}
