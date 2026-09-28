-- Migration 088: single-round-trip user init function.
-- auth/init currently does two sequential DB calls: upsert then select.
-- This function combines them into one: INSERT ON CONFLICT DO NOTHING, then SELECT.
CREATE OR REPLACE FUNCTION init_user(p_user_id text)
RETURNS TABLE(points int, display_name text, username text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO balances (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT b.points, b.display_name, b.username FROM balances b WHERE b.user_id = p_user_id;
$$;
