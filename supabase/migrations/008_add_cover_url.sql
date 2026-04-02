ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;
