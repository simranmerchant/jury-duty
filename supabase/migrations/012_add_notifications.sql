create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references balances(user_id) on delete cascade,
  type text not null, -- 'bet_resolved_won' | 'bet_resolved_lost' | 'bet_resolved_refunded' | 'bet_deadline'
  title text not null,
  body text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread on notifications(user_id, read, created_at desc);
