import { createHmac } from "crypto";

const SECRET = process.env.INVITE_SECRET ?? "dev-secret-change-in-prod";

export function generateInviteToken(eventId: string): string {
  return createHmac("sha256", SECRET).update(eventId).digest("hex").slice(0, 32);
}

export function verifyInviteToken(eventId: string, token: string): boolean {
  const expected = generateInviteToken(eventId);
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
