ALTER TABLE events
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'event'
    CHECK (type IN ('event', 'group'));

ALTER TABLE events
  ALTER COLUMN ends_at DROP NOT NULL;
