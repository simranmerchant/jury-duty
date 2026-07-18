-- Add photo_url and targeted_user_ids to poll_posts
-- photo_url: optional image attached when sharing a poll result
-- targeted_user_ids: if set, post is only visible to those specific users; null = all followers
alter table poll_posts add column if not exists photo_url text;
alter table poll_posts add column if not exists targeted_user_ids text[];
