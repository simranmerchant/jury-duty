-- Explore bets: public predictions anyone can bet on (not tied to a group/event)
create table explore_bets (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) <= 200),
  option_a text not null check (char_length(option_a) <= 80),
  option_b text not null check (char_length(option_b) <= 80),
  creator_id text not null references balances(user_id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  winning_side text check (winning_side in ('a', 'b')),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create index explore_bets_created_idx on explore_bets(created_at desc);

-- Individual wagers on explore bets (one per user per bet)
create table explore_bet_entries (
  id uuid primary key default gen_random_uuid(),
  explore_bet_id uuid not null references explore_bets(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  points_wagered int not null check (points_wagered > 0),
  created_at timestamptz not null default now(),
  unique(explore_bet_id, user_id)
);

create index explore_bet_entries_bet_idx on explore_bet_entries(explore_bet_id);

-- Public posts on explore bets — visible on the card to all users
create table explore_bet_posts (
  id uuid primary key default gen_random_uuid(),
  explore_bet_id uuid not null references explore_bets(id) on delete cascade,
  user_id text not null references balances(user_id) on delete cascade,
  caption text check (char_length(caption) <= 280),
  created_at timestamptz not null default now(),
  unique(explore_bet_id, user_id)
);

create index explore_bet_posts_bet_idx on explore_bet_posts(explore_bet_id, created_at desc);
