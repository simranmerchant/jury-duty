export type CommentValidationResult =
  | { ok: true; body: string | undefined; gif_url: string | undefined }
  | { ok: false; error: string };

export function validateComment(
  body: unknown,
  gif_url: unknown
): CommentValidationResult {
  const trimmed = typeof body === "string" ? body.trim() : undefined;
  const gif = typeof gif_url === "string" && gif_url ? gif_url : undefined;

  if (!trimmed && !gif) return { ok: false, error: "comment or gif required" };
  if (trimmed && trimmed.length > 500) return { ok: false, error: "max 500 chars" };

  return { ok: true, body: trimmed || undefined, gif_url: gif };
}
