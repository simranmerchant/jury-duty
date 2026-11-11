-- Fix migrate_user_id: use UPDATE balances SET user_id = new_id instead of INSERT+DELETE.
-- The old approach failed with a unique constraint violation on balances.username when
-- the new row was inserted while the old row still held the same username.
-- By updating child tables first then updating the PK directly, we avoid this entirely.
CREATE OR REPLACE FUNCTION migrate_user_id(old_id text, new_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF old_id = new_id THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM balances WHERE user_id = old_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM balances WHERE user_id = new_id) THEN
    DELETE FROM balances WHERE user_id = old_id;
    RETURN;
  END IF;

  -- 1. Update all child tables first so no FK references old_id when we update the PK
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

  -- 2. Update the balances PK directly — no unique constraint violation since
  --    no child table references old_id anymore and we're not inserting a duplicate row
  UPDATE balances SET user_id = new_id WHERE user_id = old_id;
END;
$$;
