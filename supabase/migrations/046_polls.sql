create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) <= 200),
  option_a text not null check (char_length(option_a) <= 80),
  option_b text not null check (char_length(option_b) <= 80),
  creator_id text not null references balances(user_id) on delete cascade,
  event_id uuid references events(id) on delete cascade, -- null = explore/global poll
  created_at timestamptz not null default now(),
  closes_at timestamptz
);

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
  body text check (char_length(body) <= 500),
  gif_url text,
  parent_id uuid references poll_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table poll_comment_likes (
  poll_comment_id uuid not null references poll_comments(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_comment_id, user_id)
);

create table poll_posts (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  caption text check (char_length(caption) <= 280),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
