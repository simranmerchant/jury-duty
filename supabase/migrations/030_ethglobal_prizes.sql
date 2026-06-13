-- ENS: store the user's linked ENS name
ALTER TABLE balances ADD COLUMN IF NOT EXISTS ens_name text;

-- World ID: mark verified humans
ALTER TABLE balances ADD COLUMN IF NOT EXISTS world_verified boolean not null default false;
ALTER TABLE balances ADD COLUMN IF NOT EXISTS world_nullifier_hash text unique;
