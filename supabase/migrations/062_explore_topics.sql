-- Topics for grouping explore bets (like Polymarket categories)
CREATE TABLE IF NOT EXISTS topics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  emoji       text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add topic_id FK to explore_bets
ALTER TABLE explore_bets ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS explore_bets_topic_id_idx ON explore_bets(topic_id);

-- Seed the first topic and assign all existing bets to it
DO $$
DECLARE
  v_topic_id uuid;
BEGIN
  INSERT INTO topics (name, emoji, description)
  VALUES ('World Cup Final', '⚽', 'Predictions for the World Cup Final')
  RETURNING id INTO v_topic_id;

  UPDATE explore_bets SET topic_id = v_topic_id;
END $$;
