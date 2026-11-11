-- Fix migrate_user_id v3.
-- balances has three unique-constrained columns: username, phone, referral_code.
-- Temporarily NULL all three on the old row before inserting the new one so the
-- INSERT doesn't violate any of them while both rows exist momentarily.
CREATE OR REPLACE FUNCTION migrate_user_id(old_id text, new_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username      text;
  v_phone         text;
  v_referral_code text;
BEGIN
  IF old_id = new_id THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM balances WHERE user_id = old_id) THEN RETURN; END IF;

  -- Remove any blank placeholder row for new_id (created by init_user on a prior
  -- login attempt before migration ran). It has no child-table references so DELETE is safe.
  DELETE FROM balances WHERE user_id = new_id;

  -- Save unique-constrained columns, then NULL them on the old row so the INSERT below
  -- doesn't hit unique violations while both rows momentarily exist.
  SELECT username, phone, referral_code
    INTO v_username, v_phone, v_referral_code
    FROM balances WHERE user_id = old_id;

  UPDATE balances SET username = NULL, phone = NULL, referral_code = NULL WHERE user_id = old_id;

  -- 1. INSERT new row with all data from old row (restoring saved unique values)
  INSERT INTO balances (user_id, points, display_name, username, avatar_url, phone, referral_code, created_at)
  SELECT new_id, points, display_name, v_username, avatar_url, v_phone, v_referral_code, created_at
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

  -- 3. Delete old row (all FKs already updated above)
  DELETE FROM balances WHERE user_id = old_id;
END;
$$;
