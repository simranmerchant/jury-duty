-- GIF and reply support for explore bet comments
alter table explore_bet_comments add column if not exists gif_url text;
alter table explore_bet_comments add column if not exists parent_id uuid references explore_bet_comments(id) on delete cascade;

-- Comment likes
create table if not exists explore_bet_comment_likes (
  explore_bet_comment_id uuid not null references explore_bet_comments(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (explore_bet_comment_id, user_id)
);
