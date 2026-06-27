-- Posts: users sharing resolved bets to their followers' feed with a caption
create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references balances(user_id) on delete cascade,
  bet_id uuid not null references bets(id) on delete cascade,
  caption text check (char_length(caption) <= 280),
  created_at timestamptz not null default now(),
  unique(user_id, bet_id)  -- one share per bet per user
);

create index posts_user_id_created_idx on posts(user_id, created_at desc);
