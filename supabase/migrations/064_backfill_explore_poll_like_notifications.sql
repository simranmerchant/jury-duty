-- Backfill notifications for explore bet likes and poll likes missed before
-- the notification system was wired up. Safe to run multiple times.

-- explore_bet_likes
INSERT INTO notifications (user_id, type, title, body, data, created_at)
SELECT
  eb.creator_id,
  'explore_bet_like',
  'new like ❤️',
  CASE
    WHEN eb.question IS NOT NULL
      THEN bl.display_name || ' liked your bet: "' || eb.question || '"'
    ELSE
      bl.display_name || ' liked your bet'
  END,
  jsonb_build_object('explore_bet_id', ebl.explore_bet_id::text),
  ebl.created_at
FROM explore_bet_likes ebl
JOIN explore_bets eb ON eb.id = ebl.explore_bet_id
JOIN balances bl ON bl.user_id = ebl.user_id
WHERE ebl.user_id != eb.creator_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = eb.creator_id
      AND n.type = 'explore_bet_like'
      AND n.data->>'explore_bet_id' = ebl.explore_bet_id::text
      AND n.body LIKE bl.display_name || ' liked your bet%'
  );

-- poll_likes
INSERT INTO notifications (user_id, type, title, body, data, created_at)
SELECT
  po.creator_id,
  'poll_like',
  'new like ❤️',
  CASE
    WHEN po.question IS NOT NULL
      THEN bl.display_name || ' liked your poll: "' || po.question || '"'
    ELSE
      bl.display_name || ' liked your poll'
  END,
  jsonb_build_object('poll_id', pl.poll_id::text),
  pl.created_at
FROM poll_likes pl
JOIN polls po ON po.id = pl.poll_id
JOIN balances bl ON bl.user_id = pl.user_id
WHERE pl.user_id != po.creator_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = po.creator_id
      AND n.type = 'poll_like'
      AND n.data->>'poll_id' = pl.poll_id::text
      AND n.body LIKE bl.display_name || ' liked your poll%'
  );
