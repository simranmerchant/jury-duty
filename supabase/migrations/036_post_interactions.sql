-- Likes on posts
create table post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);
create index post_likes_post_id_idx on post_likes(post_id);

-- Comments on posts
create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create index post_comments_post_id_created_idx on post_comments(post_id, created_at);
