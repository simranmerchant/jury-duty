-- Likes: one per user per bet
create table if not exists explore_bet_likes (
  explore_bet_id uuid not null references explore_bets(id) on delete cascade,
  user_id        text not null references balances(user_id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (explore_bet_id, user_id)
);

-- Reactions: one emoji per user per bet (same emoji again removes it)
create table if not exists explore_bet_reactions (
  explore_bet_id uuid not null references explore_bets(id) on delete cascade,
  user_id        text not null references balances(user_id) on delete cascade,
  emoji          text not null,
  created_at     timestamptz not null default now(),
  primary key (explore_bet_id, user_id)
);

-- Comments
create table if not exists explore_bet_comments (
  id             uuid primary key default gen_random_uuid(),
  explore_bet_id uuid not null references explore_bets(id) on delete cascade,
  user_id        text not null references balances(user_id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 500),
  created_at     timestamptz not null default now()
);

create index if not exists explore_bet_comments_bet_time
  on explore_bet_comments(explore_bet_id, created_at asc);
