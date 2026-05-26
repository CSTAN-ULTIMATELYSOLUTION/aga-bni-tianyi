create table if not exists public.tianyi_attendance (
  id uuid primary key default gen_random_uuid(),
  week_id integer not null references public.tianyi_weeks(id) on delete cascade,
  member_id uuid not null references public.tianyi_members(id) on delete cascade,
  attended boolean not null default true,
  marked_at timestamptz not null default now(),
  marked_by uuid references auth.users(id) on delete set null,
  unique (week_id, member_id)
);

alter table public.tianyi_attendance enable row level security;

drop policy if exists "Admins manage attendance" on public.tianyi_attendance;
create policy "Admins manage attendance" on public.tianyi_attendance
  for all using (private.is_tianyi_admin())
  with check (private.is_tianyi_admin());

drop policy if exists "Members read own attendance" on public.tianyi_attendance;
create policy "Members read own attendance" on public.tianyi_attendance
  for select using (member_id = private.current_member_id());

grant select, insert, update, delete on public.tianyi_attendance to authenticated;
