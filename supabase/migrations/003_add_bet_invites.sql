create table bet_invites (
  bet_id uuid not null references bets(id) on delete cascade,
  user_id text not null references balances(user_id),
  primary key (bet_id, user_id)
);
