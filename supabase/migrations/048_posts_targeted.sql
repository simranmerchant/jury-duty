-- Add targeted_user_ids to posts (bet posts)
-- If set, the post is only visible to those specific users; null = all followers
alter table posts add column if not exists targeted_user_ids text[];
