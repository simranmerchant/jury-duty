-- Allow gif-only comments on bets
alter table bet_comments alter column body drop not null;
alter table bet_comments drop constraint if exists bet_comments_body_check;
alter table bet_comments add column if not exists gif_url text;
-- at least one of body or gif_url must be present
alter table bet_comments add constraint bet_comments_content_check
  check (body is not null or gif_url is not null);
-- restore length check on body when text is provided
alter table bet_comments add constraint bet_comments_body_length_check
  check (body is null or (char_length(body) > 0 and char_length(body) <= 500));
