-- Follow system: one-way follows with pending/accepted states for private accounts
ALTER TABLE balances ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS follows (
  follower_id text NOT NULL REFERENCES balances(user_id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES balances(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows(following_id);
CREATE INDEX IF NOT EXISTS follows_follower_id_status_idx ON follows(follower_id, status);
CREATE INDEX IF NOT EXISTS follows_following_id_status_idx ON follows(following_id, status);
