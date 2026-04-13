create table web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
create index on web_push_subscriptions(user_id);
