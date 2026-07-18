create table if not exists bet_likes (
  bet_id uuid not null references bets(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bet_id, user_id)
);
