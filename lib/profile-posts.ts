export type RawBetPost = {
  id: string;
  photo_url: string | null;
  created_at: string;
  bets: { question: string } | null;
  post_likes: { user_id: string }[];
  post_comments: { id: string }[];
};

export type RawExploreBetPost = {
  id: string;
  explore_bet_id: string;
  photo_url: string | null;
  created_at: string;
  explore_bets: {
    question: string;
    explore_bet_likes: { user_id: string }[];
    explore_bet_comments: { id: string }[];
  } | null;
};

export type RawPollPost = {
  poll_id: string;
  photo_url: string | null;
  created_at: string;
  polls: { question: string } | null;
  poll_likes: { user_id: string }[];
  poll_comments: { id: string }[];
};

export type ProfilePost = {
  id: string;
  type: "post" | "explore_bet_post" | "poll_post";
  photo_url: string | null;
  bet_question: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
};

export function shapeProfilePosts(
  betPosts: RawBetPost[] | null,
  explorePosts: RawExploreBetPost[] | null,
  pollPosts: RawPollPost[] | null,
  limit = 60
): ProfilePost[] {
  return [
    ...(betPosts ?? []).map((p): ProfilePost => ({
      id: p.id,
      type: "post",
      photo_url: p.photo_url ?? null,
      bet_question: p.bets?.question ?? null,
      like_count: (p.post_likes ?? []).length,
      comment_count: (p.post_comments ?? []).length,
      created_at: p.created_at,
    })),
    ...(explorePosts ?? []).map((p): ProfilePost => ({
      id: p.explore_bet_id,
      type: "explore_bet_post",
      photo_url: p.photo_url ?? null,
      bet_question: p.explore_bets?.question ?? null,
      like_count: (p.explore_bets?.explore_bet_likes ?? []).length,
      comment_count: (p.explore_bets?.explore_bet_comments ?? []).length,
      created_at: p.created_at,
    })),
    ...(pollPosts ?? []).map((p): ProfilePost => ({
      id: p.poll_id,
      type: "poll_post",
      photo_url: p.photo_url ?? null,
      bet_question: p.polls?.question ?? null,
      like_count: (p.poll_likes ?? []).length,
      comment_count: (p.poll_comments ?? []).length,
      created_at: p.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
