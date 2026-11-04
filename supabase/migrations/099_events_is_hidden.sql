-- Migration 099: Allow individual events/groups to be hidden from the groups
-- page while keeping their bets intact.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Hide "The Jury" group
UPDATE events SET is_hidden = true WHERE name = 'The Jury' AND type = 'group';
