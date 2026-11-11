-- Fix migrate_user_id v4.
-- balances has three unique columns: username (nullable), phone (nullable, partial index),
-- referral_code (NOT NULL, unique). We can't temporarily NULL referral_code.
--
-- Strategy: INSERT new row with temp placeholder values for unique columns, update all
-- child tables (old → new), delete old row, then set real unique values on new row.
-- This avoids all unique/not-null violations since the two rows never share real values.
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
  v_tmp           text := '__migrating_' || new_id;
BEGIN
  IF old_id = new_id THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM balances WHERE user_id = old_id) THEN RETURN; END IF;

  -- Remove any blank placeholder row for new_id (from init_user on a prior login attempt).
  DELETE FROM balances WHERE user_id = new_id;

  -- Save the real values for unique columns.
  SELECT username, phone, referral_code
    INTO v_username, v_phone, v_referral_code
    FROM balances WHERE user_id = old_id;

  -- 1. INSERT new row with temp placeholders for unique columns so it doesn't conflict
  --    with the old row that still exists at this point.
  INSERT INTO balances (user_id, points, display_name, username, avatar_url, phone, referral_code, created_at)
  SELECT new_id, points, display_name, v_tmp, avatar_url, v_tmp, v_tmp, created_at
  FROM balances WHERE user_id = old_id;

  -- 2. Update all child tables (old_id → new_id). Both rows exist in balances so FKs are satisfied.
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

  -- 3. Delete old row (all FKs already updated above).
  DELETE FROM balances WHERE user_id = old_id;

  -- 4. Restore real unique values on the new row now that the old row is gone.
  UPDATE balances
     SET username = v_username, phone = v_phone, referral_code = v_referral_code
   WHERE user_id = new_id;
END;
$$;
