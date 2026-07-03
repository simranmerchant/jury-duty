-- Allow gif-only comments on posts
alter table post_comments alter column body drop not null;
alter table post_comments drop constraint if exists post_comments_body_check;
alter table post_comments add column if not exists gif_url text;
alter table post_comments add constraint post_comments_content_check
  check (body is not null or gif_url is not null);
alter table post_comments add constraint post_comments_body_length_check
  check (body is null or (char_length(body) > 0 and char_length(body) <= 500));
