-- Allow GIF-only comments on explore bets (body was incorrectly NOT NULL)
alter table explore_bet_comments
  alter column body drop not null;

-- Update check constraint to allow NULL body (same as poll_comments)
alter table explore_bet_comments
  drop constraint if exists explore_bet_comments_body_check;

alter table explore_bet_comments
  add constraint explore_bet_comments_body_check
    check (body is null or (char_length(body) >= 1 and char_length(body) <= 500));
