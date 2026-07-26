-- Migration 060: add missing indexes for hot query paths

-- bet_entries.option_id — used in resolve_bet RPC and vote counting per option
CREATE INDEX IF NOT EXISTS bet_entries_option_id_idx ON bet_entries(option_id);

-- event_guests.event_id — used in every event detail load and guest permission check
CREATE INDEX IF NOT EXISTS event_guests_event_id_idx ON event_guests(event_id);

-- posts.bet_id — used in get_feed subquery: NOT EXISTS (SELECT 1 FROM posts WHERE bet_id = b.id)
CREATE INDEX IF NOT EXISTS posts_bet_id_idx ON posts(bet_id);

-- bets.created_at — used for feed cursor pagination ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS bets_created_at_idx ON bets(created_at DESC);

-- explore_bets.created_at — used in list query ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS explore_bets_created_at_idx ON explore_bets(created_at DESC);

-- poll_votes compound — used in vote counting per side
CREATE INDEX IF NOT EXISTS poll_votes_poll_side_idx ON poll_votes(poll_id, side);
