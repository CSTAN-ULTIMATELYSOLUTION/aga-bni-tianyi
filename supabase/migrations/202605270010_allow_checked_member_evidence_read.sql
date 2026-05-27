drop policy if exists "Tianyi checked members read evidence files" on storage.objects;

create policy "Tianyi checked members read evidence files" on storage.objects
for select to anon, authenticated
using (bucket_id = 'tianyi-onesystem-evidence');
