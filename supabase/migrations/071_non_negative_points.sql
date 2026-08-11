-- Migration 071: prevent negative point balances.
-- Fix any existing negative rows first (safety net before adding constraint).
UPDATE balances SET points = 0 WHERE points < 0;

-- Add DB-level guard so no code path can drive balance below zero.
ALTER TABLE balances ADD CONSTRAINT balances_points_non_negative CHECK (points >= 0);

-- Update increment_balance to raise a clear error instead of letting the
-- constraint fire with a cryptic message when a negative amount would
-- push the balance below zero.
CREATE OR REPLACE FUNCTION increment_balance(p_user_id text, p_amount integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_current integer;
BEGIN
  SELECT points INTO v_current
  FROM balances WHERE user_id = p_user_id FOR UPDATE;

  IF p_amount < 0 AND v_current + p_amount < 0 THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE balances SET points = points + p_amount WHERE user_id = p_user_id;
END;
$$;
