import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { generateInviteToken } from "@/lib/invite";
import { sendPushToUsers } from "@/lib/push";
import { sendWebPushToUsers } from "@/lib/webpush";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { question, options, deadline, invitedUserIds, question_tagged_user_ids } = await req.json();

  if (!question?.trim() || question.trim().length > 200) {
    return NextResponse.json({ error: "question required (max 200 chars)" }, { status: 400 });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "at least 2 options required" }, { status: 400 });
  }
  const normalizedOptions: { label: string; tagged_user_id?: string }[] = options.map((o: any) =>
    typeof o === "string" ? { label: o } : { label: o.label, tagged_user_id: o.tagged_user_id ?? undefined }
  );
  if (normalizedOptions.some((o) => !o.label?.trim() || o.label.trim().length > 100)) {
    return NextResponse.json({ error: "each option must be 1-100 chars" }, { status: 400 });
  }
  if (!deadline) return NextResponse.json({ error: "deadline required" }, { status: 400 });
  if (new Date(deadline) <= new Date()) {
    return NextResponse.json({ error: "deadline must be in the future" }, { status: 400 });
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      event_id: null,
      creator_id: user.userId,
      question: question.trim(),
      deadline,
      visibility: "public",
      invite_token: "pending",
      ...(Array.isArray(question_tagged_user_ids) ? { question_tagged_user_ids } : {}),
    })
    .select("id")
    .single();

  if (betError || !bet) return NextResponse.json({ error: betError?.message ?? "failed" }, { status: 500 });

  const invite_token = generateInviteToken(bet.id);

  await Promise.all([
    supabase.from("bets").update({ invite_token }).eq("id", bet.id),
    supabase.from("bet_options").insert(
      normalizedOptions.map((o) => ({
        bet_id: bet.id,
        label: o.label.trim(),
        ...(o.tagged_user_id ? { tagged_user_id: o.tagged_user_id } : {}),
      }))
    ),
  ]);

  // Invite specified users and notify them
  const explicitInviteIds: string[] = Array.isArray(invitedUserIds) ? invitedUserIds : [];
  if (explicitInviteIds.length > 0) {
    const { data: creatorData } = await supabase
      .from("balances")
      .select("display_name")
      .eq("user_id", user.userId)
      .single();
    const creatorName = creatorData?.display_name ?? "someone";

    await Promise.all([
      supabase.from("bet_invites").insert(
        explicitInviteIds.map((uid) => ({ bet_id: bet.id, user_id: uid }))
      ),
      supabase.from("notifications").insert(
        explicitInviteIds.map((uid) => ({
          user_id: uid,
          type: "bet_invited",
          title: "you've been challenged 🎯",
          body: `${creatorName} wants your take: "${question.trim()}"`,
          data: { bet_id: bet.id },
        }))
      ),
      sendPushToUsers(explicitInviteIds, {
        title: "you've been challenged 🎯",
        body: `${creatorName}: "${question.trim()}"`,
        data: { bet_id: bet.id },
      }),
      sendWebPushToUsers(explicitInviteIds, {
        title: "you've been challenged 🎯",
        body: `${creatorName}: "${question.trim()}"`,
        data: { bet_id: bet.id },
      }),
    ]);
  }

  await supabase.rpc("increment_balance", { p_user_id: user.userId, p_amount: 25 });

  return NextResponse.json({ betId: bet.id, invite_token }, { status: 201 });
}
