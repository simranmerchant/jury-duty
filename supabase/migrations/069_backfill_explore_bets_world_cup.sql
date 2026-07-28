-- Re-run the World Cup Final backfill to catch any explore_bets created after
-- migration 067 ran that still have topic_id = NULL.
UPDATE explore_bets
SET    topic_id = (SELECT id FROM topics WHERE name = 'World Cup Final' LIMIT 1)
WHERE  topic_id IS NULL
  AND  EXISTS (SELECT 1 FROM topics WHERE name = 'World Cup Final');
