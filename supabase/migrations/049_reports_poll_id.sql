alter table reports
  add column if not exists reported_poll_id uuid references polls(id) on delete set null;

alter table reports
  add column if not exists reported_explore_bet_id uuid references explore_bets(id) on delete set null;
