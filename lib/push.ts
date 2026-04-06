import { supabase } from "./supabase";

export async function sendPushToUsers(
  userIds: string[],
  { title, body, data }: { title: string; body: string; data?: Record<string, string> }
) {
  if (userIds.length === 0) return;

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds);

  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    sound: "default",
    data: data ?? {},
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
}
