create table if not exists push_tokens (
  user_id text not null references balances(user_id) on delete cascade,
  token text not null,
  platform text not null default 'expo',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
