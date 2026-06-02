-- EULA acceptance tracking
create table user_agreements (
  user_id text primary key,
  agreed_at timestamptz not null default now(),
  version text not null default 'v1'
);

-- User-generated content reports
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null,
  reported_user_id text,
  reported_bet_id uuid references bets(id) on delete set null,
  reason text not null,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Blocked users
create table blocked_users (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
