-- Migration 075: add creator_id to topics so owners can delete their topics.
ALTER TABLE topics ADD COLUMN IF NOT EXISTS creator_id text;
