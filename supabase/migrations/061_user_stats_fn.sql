-- Fast user stats without fetching all bet_entries rows into JS
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id text)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total',   COUNT(*),
    'won',     COUNT(*) FILTER (WHERE b.status = 'resolved' AND b.winning_option_id = e.option_id),
    'lost',    COUNT(*) FILTER (WHERE b.status = 'resolved' AND b.winning_option_id IS NOT NULL AND b.winning_option_id != e.option_id),
    'pending', COUNT(*) FILTER (WHERE b.status = 'open')
  )
  FROM bet_entries e
  JOIN bets b ON b.id = e.bet_id
  WHERE e.user_id = p_user_id
    AND NOT (e.is_hidden_from_profile OR e.is_anonymous);
$$;

-- Win rate for a specific user (public bets only, for public profiles)
CREATE OR REPLACE FUNCTION get_user_win_rate(p_user_id text)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total_resolved', COUNT(*) FILTER (WHERE b.status = 'resolved' AND b.winning_option_id IS NOT NULL),
    'won',            COUNT(*) FILTER (WHERE b.status = 'resolved' AND b.winning_option_id = e.option_id)
  )
  FROM bet_entries e
  JOIN bets b ON b.id = e.bet_id
  WHERE e.user_id = p_user_id
    AND e.is_anonymous = false
    AND e.is_hidden_from_profile = false
    AND b.visibility = 'public';
$$;
