-- Assign any explore_bets with no topic to the existing World Cup Final topic.
UPDATE explore_bets
SET    topic_id = (SELECT id FROM topics WHERE name = 'World Cup Final' LIMIT 1)
WHERE  topic_id IS NULL
  AND  EXISTS (SELECT 1 FROM topics WHERE name = 'World Cup Final');
