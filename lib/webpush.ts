import webpush from "web-push";
import { supabase } from "./supabase";

webpush.setVapidDetails(
  "mailto:admin@jurydutygame.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendWebPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (userIds.length === 0) return;

  const { data: subs } = await supabase
    .from("web_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return;

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
}
