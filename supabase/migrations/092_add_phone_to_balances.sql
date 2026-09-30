-- Phone number backfill column — populated by scripts/backfill-privy-phones.ts
-- before the Privy → Supabase Auth migration.
ALTER TABLE balances ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS balances_phone_idx ON balances (phone) WHERE phone IS NOT NULL;
