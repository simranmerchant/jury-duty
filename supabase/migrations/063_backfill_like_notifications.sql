-- Backfill in-app notifications for post likes that happened before
-- the notification system was wired up to the likes route.
-- Safe to run multiple times: the NOT EXISTS check prevents duplicates.

INSERT INTO notifications (user_id, type, title, body, data, created_at)
SELECT
  p.user_id,
  'post_like',
  'new like ❤️',
  CASE
    WHEN b.question IS NOT NULL
      THEN bl.display_name || ' liked your post on "' || b.question || '"'
    ELSE
      bl.display_name || ' liked your post'
  END,
  jsonb_build_object('post_id', pl.post_id::text),
  pl.created_at
FROM post_likes pl
JOIN posts p ON p.id = pl.post_id
LEFT JOIN bets b ON b.id = p.bet_id
JOIN balances bl ON bl.user_id = pl.user_id
WHERE pl.user_id != p.user_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = p.user_id
      AND n.type = 'post_like'
      AND n.data->>'post_id' = pl.post_id::text
      AND n.body LIKE bl.display_name || ' liked your post%'
  );
