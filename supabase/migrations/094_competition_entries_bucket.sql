insert into storage.buckets (id, name, public)
values ('competition-entries', 'competition-entries', true)
on conflict (id) do nothing;

create policy "public read competition entries"
  on storage.objects for select
  using (bucket_id = 'competition-entries');

create policy "service role upload competition entries"
  on storage.objects for insert
  with check (bucket_id = 'competition-entries');
