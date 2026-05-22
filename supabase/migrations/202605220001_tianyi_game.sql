create schema if not exists private;

create extension if not exists pgcrypto;

create table if not exists public.tianyi_weeks (
  id integer primary key,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  month text not null
);

insert into public.tianyi_weeks (id, label, starts_on, ends_on, month) values
  (1, 'Week 1 (01/06 - 07/06)', '2026-06-01', '2026-06-07', 'June'),
  (2, 'Week 2 (08/06 - 14/06)', '2026-06-08', '2026-06-14', 'June'),
  (3, 'Week 3 (15/06 - 21/06)', '2026-06-15', '2026-06-21', 'June'),
  (4, 'Week 4 (22/06 - 28/06)', '2026-06-22', '2026-06-28', 'June'),
  (5, 'Week 5 (29/06 - 05/07)', '2026-06-29', '2026-07-05', 'July'),
  (6, 'Week 6 (06/07 - 12/07)', '2026-07-06', '2026-07-12', 'July'),
  (7, 'Week 7 (13/07 - 19/07)', '2026-07-13', '2026-07-19', 'July'),
  (8, 'Week 8 (20/07 - 26/07)', '2026-07-20', '2026-07-26', 'July'),
  (9, 'Week 9 (27/07 - 31/07)', '2026-07-27', '2026-07-31', 'July')
on conflict (id) do update set
  label = excluded.label,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  month = excluded.month;

create table if not exists public.tianyi_buddy_teams (
  id uuid primary key default gen_random_uuid(),
  team_no integer unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tianyi_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  company text,
  phone text,
  buddy_team_id uuid references public.tianyi_buddy_teams(id) on delete set null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tianyi_admin_users (
  email text primary key,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create type public.tianyi_verification_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.tianyi_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tianyi_members(id) on delete cascade,
  week_id integer not null references public.tianyi_weeks(id),
  one_to_one integer not null default 0 check (one_to_one between 0 and 2),
  training integer not null default 0 check (training between 0 and 3),
  referrals integer not null default 0 check (referrals between 0 and 50),
  tyfcb numeric(12,2) not null default 0 check (tyfcb >= 0),
  visitors integer not null default 0 check (visitors between 0 and 50),
  visitor_joined integer not null default 0 check (visitor_joined between 0 and 20),
  attended boolean not null default false,
  full_attendance_bonus boolean not null default false,
  score integer not null default 0,
  one_to_one_status public.tianyi_verification_status not null default 'pending',
  training_status public.tianyi_verification_status not null default 'pending',
  referral_status public.tianyi_verification_status not null default 'pending',
  tyfcb_status public.tianyi_verification_status not null default 'pending',
  visitor_status public.tianyi_verification_status not null default 'pending',
  admin_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, week_id)
);

create table if not exists public.tianyi_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.tianyi_submissions(id) on delete cascade,
  kind text not null check (kind in ('one_to_one', 'training', 'referral', 'tyfcb', 'visitor')),
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create or replace function private.current_member_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.tianyi_members where auth_user_id = auth.uid() and is_active = true limit 1
$$;

create or replace function private.is_tianyi_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tianyi_admin_users
    where lower(email) = lower(coalesce(auth.email(), ''))
  )
$$;

create or replace function public.tianyi_find_member(p_email text, p_name text)
returns table(member_id uuid, full_name text, email text, buddy_team_id uuid, team_no integer)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.full_name, m.email, m.buddy_team_id, bt.team_no
  from public.tianyi_members m
  left join public.tianyi_buddy_teams bt on bt.id = m.buddy_team_id
  where lower(m.email) = lower(trim(p_email))
    and lower(regexp_replace(m.full_name, '\s+', ' ', 'g')) = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))
    and m.is_active = true
  limit 1
$$;

create or replace function public.tianyi_link_current_user()
returns public.tianyi_members
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.tianyi_members;
begin
  update public.tianyi_members
  set auth_user_id = auth.uid(), updated_at = now()
  where lower(email) = lower(coalesce(auth.email(), ''))
    and is_active = true
    and (auth_user_id is null or auth_user_id = auth.uid())
  returning * into row;

  if row.id is null then
    raise exception 'No active Tianyi member found for this email.';
  end if;

  return row;
end;
$$;

create or replace function public.tianyi_available_weeks(p_today date default current_date)
returns setof public.tianyi_weeks
language sql
set search_path = public
stable
as $$
  with current_week as (
    select id from public.tianyi_weeks
    where p_today between starts_on and ends_on
    order by id
    limit 1
  )
  select w.*
  from public.tianyi_weeks w
  where w.id in (
    coalesce((select id from current_week), (select min(id) from public.tianyi_weeks)),
    greatest(coalesce((select id from current_week), (select min(id) from public.tianyi_weeks)) - 1, 1)
  )
  order by w.id desc
$$;

create or replace function public.tianyi_score(
  p_one_to_one integer,
  p_training integer,
  p_referrals integer,
  p_tyfcb numeric,
  p_visitors integer,
  p_visitor_joined integer,
  p_full_attendance boolean
)
returns integer
language sql
immutable
set search_path = public
as $$
  select
    least(coalesce(p_one_to_one, 0), 2)
    + coalesce(p_training, 0) * 5
    + coalesce(p_referrals, 0) * 5
    + case
        when coalesce(p_tyfcb, 0) >= 30000 then 12
        when coalesce(p_tyfcb, 0) >= 20000 then 9
        when coalesce(p_tyfcb, 0) >= 10000 then 6
        when coalesce(p_tyfcb, 0) >= 1000 then 3
        when coalesce(p_tyfcb, 0) >= 100 then 1
        else 0
      end
    + coalesce(p_visitors, 0) * 10
    + coalesce(p_visitor_joined, 0) * 25
    + case when coalesce(p_full_attendance, false) then 3 else 0 end
$$;

create or replace function public.tianyi_set_submission_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.full_attendance_bonus := new.attended
    and new.one_to_one > 0
    and new.training > 0
    and new.referrals > 0
    and new.tyfcb > 0
    and new.visitors > 0;
  new.score := public.tianyi_score(new.one_to_one, new.training, new.referrals, new.tyfcb, new.visitors, new.visitor_joined, new.full_attendance_bonus);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tianyi_score_before_write on public.tianyi_submissions;
create trigger tianyi_score_before_write
before insert or update on public.tianyi_submissions
for each row execute function public.tianyi_set_submission_score();

create or replace function public.tianyi_team_leaderboard()
returns table(
  team_id uuid,
  team_no integer,
  team_name text,
  members text[],
  total_score bigint,
  total_tyfcb numeric,
  submission_count bigint,
  rank bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    bt.id,
    bt.team_no,
    coalesce(bt.name, 'Buddy Team ' || bt.team_no),
    array_agg(distinct m.full_name order by m.full_name),
    coalesce(sum(s.score), 0)::bigint,
    coalesce(sum(s.tyfcb), 0),
    count(s.id)::bigint,
    dense_rank() over (order by coalesce(sum(s.score), 0) desc)
  from public.tianyi_buddy_teams bt
  left join public.tianyi_members m on m.buddy_team_id = bt.id
  left join public.tianyi_submissions s on s.member_id = m.id
  group by bt.id, bt.team_no, bt.name
  order by coalesce(sum(s.score), 0) desc, bt.team_no asc
$$;

create or replace view public.tianyi_submission_details
with (security_invoker = true)
as
select
  s.*,
  w.label as week_label,
  w.starts_on,
  w.ends_on,
  m.full_name,
  m.email,
  bt.id as buddy_team_id,
  bt.team_no,
  bt.name as buddy_team_name
from public.tianyi_submissions s
join public.tianyi_weeks w on w.id = s.week_id
join public.tianyi_members m on m.id = s.member_id
left join public.tianyi_buddy_teams bt on bt.id = m.buddy_team_id;

alter table public.tianyi_weeks enable row level security;
alter table public.tianyi_buddy_teams enable row level security;
alter table public.tianyi_members enable row level security;
alter table public.tianyi_admin_users enable row level security;
alter table public.tianyi_submissions enable row level security;
alter table public.tianyi_evidence enable row level security;

drop policy if exists "Weeks are readable" on public.tianyi_weeks;
create policy "Weeks are readable" on public.tianyi_weeks for select using (true);

drop policy if exists "Buddy teams readable by signed in members" on public.tianyi_buddy_teams;
create policy "Buddy teams readable by signed in members" on public.tianyi_buddy_teams
for select using (auth.uid() is not null);

drop policy if exists "Admins manage buddy teams" on public.tianyi_buddy_teams;
create policy "Admins manage buddy teams" on public.tianyi_buddy_teams
for all using (private.is_tianyi_admin()) with check (private.is_tianyi_admin());

drop policy if exists "Members read own profile or admins read all" on public.tianyi_members;
create policy "Members read own profile or admins read all" on public.tianyi_members
for select using (id = private.current_member_id() or private.is_tianyi_admin());

drop policy if exists "Admins manage members" on public.tianyi_members;
create policy "Admins manage members" on public.tianyi_members
for all using (private.is_tianyi_admin()) with check (private.is_tianyi_admin());

drop policy if exists "Members link their own auth user" on public.tianyi_members;
create policy "Members link their own auth user" on public.tianyi_members
for update
using (
  lower(email) = lower(coalesce(auth.email(), ''))
  and is_active = true
  and (auth_user_id is null or auth_user_id = auth.uid())
)
with check (
  lower(email) = lower(coalesce(auth.email(), ''))
  and is_active = true
  and auth_user_id = auth.uid()
);

drop policy if exists "Admin users read own admin status" on public.tianyi_admin_users;
create policy "Admin users read own admin status" on public.tianyi_admin_users
for select using (lower(email) = lower(coalesce(auth.email(), '')) or private.is_tianyi_admin());

drop policy if exists "Members read own submissions or admins read all" on public.tianyi_submissions;
create policy "Members read own submissions or admins read all" on public.tianyi_submissions
for select using (member_id = private.current_member_id() or private.is_tianyi_admin());

drop policy if exists "Members create own submissions" on public.tianyi_submissions;
create policy "Members create own submissions" on public.tianyi_submissions
for insert with check (member_id = private.current_member_id());

drop policy if exists "Admins update submissions" on public.tianyi_submissions;
create policy "Admins update submissions" on public.tianyi_submissions
for update using (private.is_tianyi_admin()) with check (private.is_tianyi_admin());

drop policy if exists "Evidence readable by owner or admin" on public.tianyi_evidence;
create policy "Evidence readable by owner or admin" on public.tianyi_evidence
for select using (
  exists (
    select 1 from public.tianyi_submissions s
    where s.id = submission_id
      and (s.member_id = private.current_member_id() or private.is_tianyi_admin())
  )
);

drop policy if exists "Members create evidence for own submissions" on public.tianyi_evidence;
create policy "Members create evidence for own submissions" on public.tianyi_evidence
for insert with check (
  exists (
    select 1 from public.tianyi_submissions s
    where s.id = submission_id
      and s.member_id = private.current_member_id()
  )
);

drop policy if exists "Admins manage evidence" on public.tianyi_evidence;
create policy "Admins manage evidence" on public.tianyi_evidence
for all using (private.is_tianyi_admin()) with check (private.is_tianyi_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tianyi-evidence', 'tianyi-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Evidence files readable by signed in users" on storage.objects;
create policy "Evidence files readable by signed in users" on storage.objects
for select using (bucket_id = 'tianyi-evidence' and auth.uid() is not null);

drop policy if exists "Members upload evidence files" on storage.objects;
create policy "Members upload evidence files" on storage.objects
for insert with check (
  bucket_id = 'tianyi-evidence'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = private.current_member_id()::text
);

drop policy if exists "Admins manage evidence files" on storage.objects;
create policy "Admins manage evidence files" on storage.objects
for all using (bucket_id = 'tianyi-evidence' and private.is_tianyi_admin())
with check (bucket_id = 'tianyi-evidence' and private.is_tianyi_admin());

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
revoke execute on function public.tianyi_find_member(text, text) from public;
revoke execute on function public.tianyi_link_current_user() from public;
revoke execute on function public.tianyi_available_weeks(date) from public;
revoke execute on function public.tianyi_team_leaderboard() from public;
grant execute on function public.tianyi_find_member(text, text) to anon, authenticated;
grant execute on function public.tianyi_link_current_user() to authenticated;
grant execute on function public.tianyi_available_weeks(date) to anon, authenticated;
grant execute on function public.tianyi_team_leaderboard() to authenticated;
grant select on public.tianyi_weeks to anon, authenticated;
grant select, insert, update on public.tianyi_buddy_teams to authenticated;
grant select, insert, update on public.tianyi_members to authenticated;
grant select on public.tianyi_admin_users to authenticated;
grant select, insert, update on public.tianyi_submissions to authenticated;
grant select, insert, update on public.tianyi_evidence to authenticated;
