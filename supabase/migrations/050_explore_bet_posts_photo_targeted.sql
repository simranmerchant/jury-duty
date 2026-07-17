alter table explore_bet_posts
  add column if not exists photo_url text,
  add column if not exists targeted_user_ids text[];
