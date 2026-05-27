drop policy if exists "Tianyi checked members delete evidence files" on storage.objects;

create policy "Tianyi checked members delete evidence files" on storage.objects
for delete to anon, authenticated
using (
  bucket_id = 'tianyi-onesystem-evidence'
  and tianyi_private.active_member_exists((storage.foldername(name))[1])
);
