-- Atomically migrates all data from an old Privy user_id to a new Supabase Auth UUID.
-- Called by auth/init when an existing user logs in via Supabase for the first time.
-- Strategy: INSERT new balances row, UPDATE all child tables, DELETE old balances row.
-- The ON DELETE CASCADE rows are updated before deletion so they are not lost.
CREATE OR REPLACE FUNCTION migrate_user_id(old_id text, new_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op if already migrated or same ID
  IF old_id = new_id THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM balances WHERE user_id = old_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM balances WHERE user_id = new_id) THEN
    -- New user row already exists; just clean up stale old row references
    -- (can happen if migration ran partially before)
    DELETE FROM balances WHERE user_id = old_id;
    RETURN;
  END IF;

  -- 1. Copy balances row with new_id
  INSERT INTO balances (user_id, points, display_name, username, avatar_url, phone, created_at)
  SELECT new_id, points, display_name, username, avatar_url, phone, created_at
  FROM balances WHERE user_id = old_id;

  -- 2. Update all tables referencing user identity
  UPDATE events            SET host_id     = new_id WHERE host_id       = old_id;
  UPDATE event_guests      SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE event_last_seen   SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE bets              SET creator_id  = new_id WHERE creator_id    = old_id;
  UPDATE bets              SET resolved_by = new_id WHERE resolved_by   = old_id;
  UPDATE bet_entries       SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE bet_invites       SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE bet_comments      SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE bet_reactions     SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE bet_likes         SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE comment_likes     SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE notifications     SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE push_tokens       SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE web_push_subscriptions SET user_id = new_id WHERE user_id      = old_id;
  UPDATE posts             SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE post_likes        SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE post_comments     SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE follows           SET follower_id = new_id WHERE follower_id   = old_id;
  UPDATE follows           SET following_id= new_id WHERE following_id  = old_id;
  UPDATE blocked_users     SET blocker_id  = new_id WHERE blocker_id    = old_id;
  UPDATE blocked_users     SET blocked_id  = new_id WHERE blocked_id    = old_id;
  UPDATE reports           SET reporter_id = new_id WHERE reporter_id   = old_id;
  UPDATE reports           SET reported_user_id = new_id WHERE reported_user_id = old_id;
  UPDATE user_agreements   SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE explore_bets      SET creator_id  = new_id WHERE creator_id    = old_id;
  UPDATE explore_bet_entries  SET user_id  = new_id WHERE user_id       = old_id;
  UPDATE explore_bet_posts    SET user_id  = new_id WHERE user_id       = old_id;
  UPDATE explore_bet_comments SET user_id  = new_id WHERE user_id       = old_id;
  UPDATE explore_bet_likes    SET user_id  = new_id WHERE user_id       = old_id;
  UPDATE explore_bet_reactions SET user_id = new_id WHERE user_id       = old_id;
  UPDATE explore_bet_comment_likes SET user_id = new_id WHERE user_id   = old_id;
  UPDATE polls             SET creator_id  = new_id WHERE creator_id    = old_id;
  UPDATE poll_votes        SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE poll_comments     SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE poll_comment_likes SET user_id    = new_id WHERE user_id       = old_id;
  UPDATE poll_likes        SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE poll_reactions    SET user_id     = new_id WHERE user_id       = old_id;
  UPDATE poll_posts        SET user_id     = new_id WHERE user_id       = old_id;

  -- 3. Delete old balances row (all FKs already updated, cascades are safe)
  DELETE FROM balances WHERE user_id = old_id;
END;
$$;
