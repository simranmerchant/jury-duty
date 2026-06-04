-- Update default starting balance 500 → 200
ALTER TABLE balances ALTER COLUMN points SET DEFAULT 200;
