-- Add question_tagged_user_ids to bets for tagging users in the bet question
ALTER TABLE bets ADD COLUMN IF NOT EXISTS question_tagged_user_ids text[] DEFAULT '{}';
