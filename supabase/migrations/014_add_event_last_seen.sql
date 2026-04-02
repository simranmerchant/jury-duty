create table event_last_seen (
  user_id text not null references balances(user_id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
