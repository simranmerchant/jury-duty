-- Migration 078: add phone column to balances for contact matching.
-- Stores the user's primary linked phone number in E.164 format.
-- Nullable (not all users link a phone), unique so we can match efficiently.
ALTER TABLE balances ADD COLUMN IF NOT EXISTS phone text;
CREATE UNIQUE INDEX IF NOT EXISTS balances_phone_idx ON balances (phone) WHERE phone IS NOT NULL;
