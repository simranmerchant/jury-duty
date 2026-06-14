create table if not exists usdc_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references balances(user_id) on delete cascade,
  to_address text not null,
  cents integer not null,
  tx_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists usdc_withdrawals_user_id_idx on usdc_withdrawals(user_id);
