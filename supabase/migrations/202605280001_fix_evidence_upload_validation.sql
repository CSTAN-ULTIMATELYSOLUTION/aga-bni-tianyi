insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tianyi-onesystem-evidence',
  'tianyi-onesystem-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Tianyi checked members upload evidence files" on storage.objects;
create policy "Tianyi checked members upload evidence files" on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'tianyi-onesystem-evidence'
  and tianyi_private.active_member_exists((storage.foldername(name))[1])
);

drop policy if exists "Tianyi checked members read evidence files" on storage.objects;
create policy "Tianyi checked members read evidence files" on storage.objects
for select
to anon, authenticated
using (bucket_id = 'tianyi-onesystem-evidence');
