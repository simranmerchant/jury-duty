create table if not exists blink_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references balances(user_id) on delete cascade,
  transfer_id text not null unique,
  amount_usd numeric(10, 2) not null,
  points_credited integer not null,
  created_at timestamptz not null default now()
);

create index if not exists blink_deposits_user_id_idx on blink_deposits(user_id);
