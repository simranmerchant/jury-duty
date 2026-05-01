create table bet_comments (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets(id) on delete cascade,
  user_id text not null references balances(user_id),
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index bet_comments_bet_id_idx on bet_comments(bet_id);
