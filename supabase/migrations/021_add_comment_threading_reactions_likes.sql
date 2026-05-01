-- Thread replies on comments
ALTER TABLE bet_comments ADD COLUMN IF NOT EXISTS parent_id uuid references bet_comments(id) on delete cascade;
CREATE INDEX IF NOT EXISTS bet_comments_parent_id_idx ON bet_comments(parent_id);

-- Reactions on bets (one emoji per user per bet)
CREATE TABLE IF NOT EXISTS bet_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id uuid NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES balances(user_id),
  emoji text NOT NULL CHECK (emoji IN ('🔥','👀','💀','😂','🤝','🫡')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bet_id, user_id)
);
CREATE INDEX IF NOT EXISTS bet_reactions_bet_id_idx ON bet_reactions(bet_id);

-- Likes on comments
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES bet_comments(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES balances(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON comment_likes(comment_id);
