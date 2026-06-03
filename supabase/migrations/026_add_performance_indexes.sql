-- bets: filter by event (FK has no auto-index in Postgres) + common (event, status) filter
CREATE INDEX IF NOT EXISTS bets_event_id_idx ON bets(event_id);
CREATE INDEX IF NOT EXISTS bets_event_id_status_idx ON bets(event_id, status);

-- bet_entries: filter by user for history/stats pages; covered by unique(bet_id,user_id) for bet lookups
CREATE INDEX IF NOT EXISTS bet_entries_user_id_idx ON bet_entries(user_id);
CREATE INDEX IF NOT EXISTS bet_entries_user_id_created_at_idx ON bet_entries(user_id, created_at DESC);

-- event_guests: filter by user_id to find all events a user belongs to
CREATE INDEX IF NOT EXISTS event_guests_user_id_idx ON event_guests(user_id);

-- notifications: fetch/sort by user (most common query pattern)
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON notifications(user_id, read);

-- bets: filter by creator (for "my bets" queries)
CREATE INDEX IF NOT EXISTS bets_creator_id_idx ON bets(creator_id);
