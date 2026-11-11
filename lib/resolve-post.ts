export type ResolveBet = {
  event_id: string | null;
};

export function shouldCreatePost(
  bet: ResolveBet | null | undefined,
  caption: string | undefined,
  photo_url: string | undefined,
  video_url: string | undefined
): boolean {
  return !!(bet && (caption || photo_url || video_url));
}
