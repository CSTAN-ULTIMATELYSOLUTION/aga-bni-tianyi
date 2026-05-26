create schema if not exists tianyi;
create schema if not exists tianyi_private;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tianyi'
      and t.typname = 'tianyi_verification_status'
  ) then
    create type tianyi.tianyi_verification_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

create table if not exists tianyi.weeks (
  id integer primary key,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  month text not null
);

insert into tianyi.weeks (id, label, starts_on, ends_on, month) values
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

create table if not exists tianyi.buddy_teams (
  id uuid primary key default gen_random_uuid(),
  team_no integer unique,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tianyi.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  company text,
  phone text,
  service_title text,
  service_description text,
  contact_url text,
  buddy_team_id uuid references tianyi.buddy_teams(id) on delete set null,
  buddy_member_id uuid references tianyi.members(id) on delete set null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tianyi.admin_users (
  email text primary key,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists tianyi.attendance (
  id uuid primary key default gen_random_uuid(),
  week_id integer not null references tianyi.weeks(id) on delete cascade,
  member_id uuid not null references tianyi.members(id) on delete cascade,
  attended boolean not null default true,
  marked_at timestamptz not null default now(),
  marked_by uuid references auth.users(id) on delete set null,
  unique (week_id, member_id)
);

create table if not exists tianyi.submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references tianyi.members(id) on delete cascade,
  week_id integer not null references tianyi.weeks(id),
  one_to_one integer not null default 0 check (one_to_one between 0 and 2),
  training integer not null default 0 check (training between 0 and 3),
  referrals integer not null default 0 check (referrals between 0 and 50),
  tyfcb numeric(12,2) not null default 0 check (tyfcb >= 0),
  visitors integer not null default 0 check (visitors between 0 and 50),
  visitor_joined integer not null default 0 check (visitor_joined between 0 and 20),
  attended boolean not null default false,
  full_attendance_bonus boolean not null default false,
  score integer not null default 0,
  one_to_one_status tianyi.tianyi_verification_status not null default 'pending',
  training_status tianyi.tianyi_verification_status not null default 'pending',
  referral_status tianyi.tianyi_verification_status not null default 'pending',
  tyfcb_status tianyi.tianyi_verification_status not null default 'pending',
  visitor_status tianyi.tianyi_verification_status not null default 'pending',
  status text not null default 'active' check (status in ('active', 'archived')),
  admin_note text,
  archived_at timestamptz,
  archived_reason text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists submissions_one_active_per_member_week_idx
on tianyi.submissions (member_id, week_id)
where status = 'active';

create table if not exists tianyi.evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references tianyi.submissions(id) on delete cascade,
  kind text not null check (kind in ('one_to_one', 'training', 'referral', 'tyfcb', 'visitor')),
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create or replace function tianyi_private.current_member_id()
returns uuid
language sql
security definer
set search_path = tianyi
stable
as $$
  select id from tianyi.members where auth_user_id = auth.uid() and is_active = true limit 1
$$;

create or replace function tianyi_private.is_admin()
returns boolean
language sql
security definer
set search_path = tianyi
stable
as $$
  select exists (
    select 1
    from tianyi.admin_users
    where lower(email) = lower(coalesce(auth.email(), ''))
  )
$$;

create or replace function tianyi.find_member(p_email text, p_name text)
returns table(member_id uuid, full_name text, email text, buddy_team_id uuid, team_no integer)
language sql
security definer
set search_path = tianyi
stable
as $$
  select m.id, m.full_name, m.email, m.buddy_team_id, bt.team_no
  from tianyi.members m
  left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
  where lower(m.email) = lower(trim(p_email))
    and lower(regexp_replace(m.full_name, '\s+', ' ', 'g')) = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))
    and m.is_active = true
  limit 1
$$;

create or replace function tianyi.link_current_user()
returns tianyi.members
language plpgsql
security invoker
set search_path = tianyi
as $$
declare
  row tianyi.members;
begin
  update tianyi.members
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

create or replace function tianyi.score(
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
set search_path = tianyi
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

create or replace function tianyi.set_submission_score()
returns trigger
language plpgsql
set search_path = tianyi
as $$
declare
  admin_attended boolean;
  approved_one_to_one integer;
  approved_training integer;
  approved_referrals integer;
  approved_tyfcb numeric;
  approved_visitors integer;
  approved_visitor_joined integer;
begin
  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
    new.full_attendance_bonus := false;
    new.score := 0;
    new.updated_at := now();
    return new;
  end if;

  select exists (
    select 1 from tianyi.attendance a
    where a.member_id = new.member_id
      and a.week_id = new.week_id
      and a.attended = true
  ) into admin_attended;

  new.attended := admin_attended;
  approved_one_to_one := case when new.one_to_one_status = 'approved' then new.one_to_one else 0 end;
  approved_training := case when new.training_status = 'approved' then new.training else 0 end;
  approved_referrals := case when new.referral_status = 'approved' then new.referrals else 0 end;
  approved_tyfcb := case when new.tyfcb_status = 'approved' then new.tyfcb else 0 end;
  approved_visitors := case when new.visitor_status = 'approved' then new.visitors else 0 end;
  approved_visitor_joined := case when new.visitor_status = 'approved' then new.visitor_joined else 0 end;

  new.full_attendance_bonus := admin_attended
    and approved_one_to_one > 0
    and approved_training > 0
    and approved_referrals > 0
    and approved_tyfcb > 0
    and approved_visitors > 0;
  new.score := tianyi.score(approved_one_to_one, approved_training, approved_referrals, approved_tyfcb, approved_visitors, approved_visitor_joined, new.full_attendance_bonus);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists score_before_write on tianyi.submissions;
create trigger score_before_write
before insert or update on tianyi.submissions
for each row execute function tianyi.set_submission_score();

create or replace function tianyi.refresh_attendance_scores()
returns trigger
language plpgsql
set search_path = tianyi
as $$
declare
  target_week_id integer;
  target_member_id uuid;
begin
  target_week_id := coalesce(new.week_id, old.week_id);
  target_member_id := coalesce(new.member_id, old.member_id);

  update tianyi.submissions
  set updated_at = now()
  where week_id = target_week_id
    and member_id = target_member_id
    and status = 'active';

  return coalesce(new, old);
end;
$$;

drop trigger if exists attendance_refresh_scores on tianyi.attendance;
create trigger attendance_refresh_scores
after insert or update or delete on tianyi.attendance
for each row execute function tianyi.refresh_attendance_scores();

create or replace view tianyi.submission_details
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
from tianyi.submissions s
join tianyi.weeks w on w.id = s.week_id
join tianyi.members m on m.id = s.member_id
left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id;

create or replace function tianyi.team_leaderboard()
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
set search_path = tianyi
stable
as $$
  select
    bt.id,
    bt.team_no,
    coalesce(bt.name, 'Buddy Pair ' || bt.team_no),
    array_remove(array_agg(distinct m.full_name order by m.full_name), null),
    coalesce(sum(s.score), 0)::bigint,
    coalesce(sum(case when s.tyfcb_status = 'approved' and s.status = 'active' then s.tyfcb else 0 end), 0),
    count(s.id) filter (where s.status = 'active')::bigint,
    dense_rank() over (order by coalesce(sum(s.score), 0) desc)
  from tianyi.buddy_teams bt
  left join tianyi.members m on m.buddy_team_id = bt.id and m.is_active = true
  left join tianyi.submissions s on s.member_id = m.id and s.status = 'active'
  where bt.is_active = true
  group by bt.id, bt.team_no, bt.name
  order by coalesce(sum(s.score), 0) desc, bt.team_no asc
$$;

create or replace function tianyi.archive_submission(
  p_submission_id uuid,
  p_reason text default null
)
returns tianyi.submissions
language plpgsql
security invoker
set search_path = tianyi
as $$
declare
  row tianyi.submissions;
begin
  update tianyi.submissions
  set status = 'archived',
      archived_at = now(),
      archived_reason = p_reason,
      admin_note = coalesce(p_reason, admin_note)
  where id = p_submission_id
    and tianyi_private.is_admin()
  returning * into row;

  if row.id is null then
    raise exception 'Submission not found or not allowed.';
  end if;

  return row;
end;
$$;

create or replace function tianyi.assign_buddy_pair(
  p_member_id uuid,
  p_buddy_member_id uuid,
  p_team_no integer default null
)
returns tianyi.buddy_teams
language plpgsql
security invoker
set search_path = tianyi
as $$
declare
  target_team tianyi.buddy_teams;
begin
  if not tianyi_private.is_admin() then
    raise exception 'Not allowed.';
  end if;

  if p_member_id = p_buddy_member_id then
    raise exception 'A member cannot be their own buddy.';
  end if;

  if p_team_no is null then
    select bt.* into target_team
    from tianyi.buddy_teams bt
    where bt.is_active = true
      and (
        exists (select 1 from tianyi.members m where m.id in (p_member_id, p_buddy_member_id) and m.buddy_team_id = bt.id)
        or (select count(*) from tianyi.members m where m.buddy_team_id = bt.id and m.is_active = true) = 0
      )
    order by bt.team_no
    limit 1;
  else
    insert into tianyi.buddy_teams (team_no, name)
    values (p_team_no, 'Buddy Pair ' || p_team_no)
    on conflict (team_no) do update set is_active = true
    returning * into target_team;
  end if;

  if target_team.id is null then
    raise exception 'No available buddy pair found.';
  end if;

  update tianyi.members
  set buddy_team_id = target_team.id,
      buddy_member_id = case when id = p_member_id then p_buddy_member_id else p_member_id end,
      updated_at = now()
  where id in (p_member_id, p_buddy_member_id);

  update tianyi.members
  set buddy_team_id = null,
      buddy_member_id = null,
      updated_at = now()
  where buddy_team_id = target_team.id
    and id not in (p_member_id, p_buddy_member_id);

  return target_team;
end;
$$;

alter table tianyi.weeks enable row level security;
alter table tianyi.buddy_teams enable row level security;
alter table tianyi.members enable row level security;
alter table tianyi.admin_users enable row level security;
alter table tianyi.attendance enable row level security;
alter table tianyi.submissions enable row level security;
alter table tianyi.evidence enable row level security;

drop policy if exists "Weeks are readable" on tianyi.weeks;
create policy "Weeks are readable" on tianyi.weeks for select using (true);

drop policy if exists "Buddy teams readable by members" on tianyi.buddy_teams;
create policy "Buddy teams readable by members" on tianyi.buddy_teams
for select using (auth.uid() is not null);

drop policy if exists "Admins manage buddy teams" on tianyi.buddy_teams;
create policy "Admins manage buddy teams" on tianyi.buddy_teams
for all using (tianyi_private.is_admin()) with check (tianyi_private.is_admin());

drop policy if exists "Members read own profile or admins read all" on tianyi.members;
create policy "Members read own profile or admins read all" on tianyi.members
for select using (id = tianyi_private.current_member_id() or tianyi_private.is_admin());

drop policy if exists "Admins manage members" on tianyi.members;
create policy "Admins manage members" on tianyi.members
for all using (tianyi_private.is_admin()) with check (tianyi_private.is_admin());

drop policy if exists "Members link their own auth user" on tianyi.members;
create policy "Members link their own auth user" on tianyi.members
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

drop policy if exists "Admin users read own admin status" on tianyi.admin_users;
create policy "Admin users read own admin status" on tianyi.admin_users
for select using (lower(email) = lower(coalesce(auth.email(), '')) or tianyi_private.is_admin());

drop policy if exists "Admins manage attendance" on tianyi.attendance;
create policy "Admins manage attendance" on tianyi.attendance
for all using (tianyi_private.is_admin()) with check (tianyi_private.is_admin());

drop policy if exists "Members read own attendance" on tianyi.attendance;
create policy "Members read own attendance" on tianyi.attendance
for select using (member_id = tianyi_private.current_member_id());

drop policy if exists "Members read own submissions or admins read all" on tianyi.submissions;
create policy "Members read own submissions or admins read all" on tianyi.submissions
for select using (member_id = tianyi_private.current_member_id() or tianyi_private.is_admin());

drop policy if exists "Members create own submissions" on tianyi.submissions;
create policy "Members create own submissions" on tianyi.submissions
for insert with check (member_id = tianyi_private.current_member_id() and status = 'active');

drop policy if exists "Admins update submissions" on tianyi.submissions;
create policy "Admins update submissions" on tianyi.submissions
for update using (tianyi_private.is_admin()) with check (tianyi_private.is_admin());

drop policy if exists "Evidence readable by owner or admin" on tianyi.evidence;
create policy "Evidence readable by owner or admin" on tianyi.evidence
for select using (
  exists (
    select 1 from tianyi.submissions s
    where s.id = submission_id
      and (s.member_id = tianyi_private.current_member_id() or tianyi_private.is_admin())
  )
);

drop policy if exists "Members create evidence for own submissions" on tianyi.evidence;
create policy "Members create evidence for own submissions" on tianyi.evidence
for insert with check (
  exists (
    select 1 from tianyi.submissions s
    where s.id = submission_id
      and s.member_id = tianyi_private.current_member_id()
  )
);

drop policy if exists "Admins manage evidence" on tianyi.evidence;
create policy "Admins manage evidence" on tianyi.evidence
for all using (tianyi_private.is_admin()) with check (tianyi_private.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tianyi-onesystem-evidence', 'tianyi-onesystem-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Tianyi evidence files readable by owner or admin" on storage.objects;
create policy "Tianyi evidence files readable by owner or admin" on storage.objects
for select using (
  bucket_id = 'tianyi-onesystem-evidence'
  and (
    tianyi_private.is_admin()
    or (storage.foldername(name))[1] = tianyi_private.current_member_id()::text
  )
);

drop policy if exists "Tianyi members upload own evidence files" on storage.objects;
create policy "Tianyi members upload own evidence files" on storage.objects
for insert with check (
  bucket_id = 'tianyi-onesystem-evidence'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = tianyi_private.current_member_id()::text
);

drop policy if exists "Tianyi admins manage evidence files" on storage.objects;
create policy "Tianyi admins manage evidence files" on storage.objects
for all using (bucket_id = 'tianyi-onesystem-evidence' and tianyi_private.is_admin())
with check (bucket_id = 'tianyi-onesystem-evidence' and tianyi_private.is_admin());

grant usage on schema tianyi to anon, authenticated;
grant usage on schema tianyi_private to authenticated;
grant select on tianyi.weeks to anon, authenticated;
grant select, insert, update on tianyi.buddy_teams to authenticated;
grant select, insert, update on tianyi.members to authenticated;
grant select on tianyi.admin_users to authenticated;
grant select, insert, update on tianyi.attendance to authenticated;
grant select, insert, update on tianyi.submissions to authenticated;
grant select, insert, update on tianyi.evidence to authenticated;
grant select on tianyi.submission_details to authenticated;

revoke execute on function tianyi.find_member(text, text) from public;
revoke execute on function tianyi.link_current_user() from public;
revoke execute on function tianyi.team_leaderboard() from public;
revoke execute on function tianyi.archive_submission(uuid, text) from public;
revoke execute on function tianyi.assign_buddy_pair(uuid, uuid, integer) from public;
grant execute on function tianyi.find_member(text, text) to anon, authenticated;
grant execute on function tianyi.link_current_user() to authenticated;
grant execute on function tianyi.team_leaderboard() to authenticated;
grant execute on function tianyi.archive_submission(uuid, text) to authenticated;
grant execute on function tianyi.assign_buddy_pair(uuid, uuid, integer) to authenticated;
