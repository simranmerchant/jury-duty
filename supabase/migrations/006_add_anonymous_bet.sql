ALTER TABLE bet_entries ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
