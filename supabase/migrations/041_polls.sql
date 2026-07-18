-- Polls: binary-choice questions users can post to the feed
create table polls (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references balances(user_id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  question text not null check (char_length(question) > 0 and char_length(question) <= 280),
  option_a text not null check (char_length(option_a) > 0 and char_length(option_a) <= 100),
  option_b text not null check (char_length(option_b) > 0 and char_length(option_b) <= 100),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

-- One vote per user per poll (toggleable by upsert)
create table poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table poll_likes (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- One reaction per user per poll (last emoji wins)
create table poll_reactions (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table poll_comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index poll_comments_poll_id_idx on poll_comments(poll_id, created_at);

-- Sharing a poll to the follower feed (one share per user per poll)
create table poll_posts (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  caption text check (char_length(caption) <= 280),
  photo_url text,
  targeted_user_ids text[],
  created_at timestamptz not null default now(),
  unique(poll_id, user_id)
);

create index poll_posts_user_id_created_idx on poll_posts(user_id, created_at desc);
create index polls_event_id_idx on polls(event_id) where event_id is not null;
