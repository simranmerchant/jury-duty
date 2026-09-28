-- Migration 086: two missing partial indexes that affect every feed load.

-- 1. balances.is_private partial index
--    get_feed runs `NOT EXISTS (SELECT 1 FROM balances WHERE user_id = x AND is_private = true)`
--    for every post/poll_post/explore_bet_post row with no index on is_private.
--    This partial index covers only private accounts (typically a tiny fraction of users),
--    making the existence check O(1) instead of a full scan.
CREATE INDEX IF NOT EXISTS balances_private_user_idx
  ON balances(user_id)
  WHERE is_private = true;

-- 2. posts feed_visible partial index
--    Migration 082 added `AND p.feed_visible = true` to the posts section of get_feed,
--    but the existing posts_user_created_idx doesn't filter on feed_visible.
--    This replaces the hot path with a narrower index that only covers feed-visible posts.
CREATE INDEX IF NOT EXISTS posts_feed_user_created_idx
  ON posts(user_id, created_at DESC)
  WHERE feed_visible = true;
