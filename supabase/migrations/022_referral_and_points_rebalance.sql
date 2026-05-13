-- Update default starting balance 1000 → 500
ALTER TABLE balances ALTER COLUMN points SET DEFAULT 500;

-- Add referral tracking columns
ALTER TABLE balances
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by text REFERENCES balances(user_id);

-- Generate codes for all existing users
UPDATE balances
SET referral_code = lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

ALTER TABLE balances ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS balances_referral_code_key ON balances(referral_code);

-- Auto-generate a unique referral code on new user insert
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      candidate := lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM balances WHERE referral_code = candidate);
    END LOOP;
    NEW.referral_code := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_referral_code
BEFORE INSERT ON balances
FOR EACH ROW EXECUTE FUNCTION set_referral_code();
