drop policy if exists "Anon can upload Tianyi evidence after pair check" on storage.objects;
drop policy if exists "Tianyi checked members upload evidence files" on storage.objects;

create policy "Tianyi checked members upload evidence files" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'tianyi-onesystem-evidence'
  and exists (
    select 1
    from tianyi.members m
    where m.id::text = (storage.foldername(name))[1]
      and m.is_active = true
  )
);
