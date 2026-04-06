-- Add username to balances
ALTER TABLE balances ADD COLUMN IF NOT EXISTS username text UNIQUE;
CREATE INDEX IF NOT EXISTS balances_username_idx ON balances (username);

-- Add tagged_user_id to bet_options
ALTER TABLE bet_options ADD COLUMN IF NOT EXISTS tagged_user_id text REFERENCES balances(user_id);
CREATE INDEX IF NOT EXISTS bet_options_tagged_user_id_idx ON bet_options (tagged_user_id);
