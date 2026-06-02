export async function notifyAdmin(subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[admin-notify]", subject, body);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "noreply@juryduty.app",
      to: "simranmerchant12@gmail.com",
      subject,
      text: body,
    }),
  }).catch(() => {});
}
