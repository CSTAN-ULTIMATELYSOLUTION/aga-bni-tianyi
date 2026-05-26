grant usage on schema tianyi to anon;
grant select (id, full_name, company) on tianyi.members to anon;

drop policy if exists "Active member names readable for login" on tianyi.members;
create policy "Active member names readable for login" on tianyi.members
  for select
  to anon
  using (is_active = true);
