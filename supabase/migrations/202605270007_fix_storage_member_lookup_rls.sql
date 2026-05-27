create or replace function tianyi_private.active_member_exists(p_member_id text)
returns boolean
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select exists (
    select 1
    from tianyi.members m
    where m.id::text = p_member_id
      and m.is_active = true
  )
$$;

grant usage on schema tianyi_private to anon, authenticated;
grant execute on function tianyi_private.active_member_exists(text) to anon, authenticated;

drop policy if exists "Tianyi checked members upload evidence files" on storage.objects;

create policy "Tianyi checked members upload evidence files" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'tianyi-onesystem-evidence'
  and tianyi_private.active_member_exists((storage.foldername(name))[1])
);
