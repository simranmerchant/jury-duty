-- Add optional photo to posts (shared bet memories)
alter table posts add column if not exists photo_url text;

-- Storage bucket for post photos (public read, server-side writes only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 10485760, '{"image/jpeg","image/png","image/webp"}')
on conflict (id) do nothing;

create policy "post_photos_public_read" on storage.objects
  for select using (bucket_id = 'post-photos');
