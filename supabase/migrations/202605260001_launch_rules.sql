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

alter table public.tianyi_submissions
add column if not exists status text not null default 'active'
  check (status in ('active', 'archived')),
add column if not exists archived_at timestamptz,
add column if not exists archived_reason text;

alter table public.tianyi_buddy_teams
add column if not exists is_active boolean not null default true;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'tianyi_submissions'
      and constraint_name = 'tianyi_submissions_member_id_week_id_key'
  ) then
    alter table public.tianyi_submissions
    drop constraint tianyi_submissions_member_id_week_id_key;
  end if;
end $$;

create unique index if not exists tianyi_submissions_one_active_per_member_week_idx
on public.tianyi_submissions (member_id, week_id)
where status = 'active';

create unique index if not exists tianyi_members_one_buddy_per_pair_idx
on public.tianyi_members (buddy_team_id, id)
where is_active = true and buddy_team_id is not null;

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
    select 1
    from public.tianyi_attendance a
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
  new.score := public.tianyi_score(approved_one_to_one, approved_training, approved_referrals, approved_tyfcb, approved_visitors, approved_visitor_joined, new.full_attendance_bonus);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tianyi_score_before_write on public.tianyi_submissions;
create trigger tianyi_score_before_write
before insert or update on public.tianyi_submissions
for each row execute function public.tianyi_set_submission_score();

create or replace function public.tianyi_refresh_attendance_scores()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_week_id integer;
  target_member_id uuid;
begin
  target_week_id := coalesce(new.week_id, old.week_id);
  target_member_id := coalesce(new.member_id, old.member_id);

  update public.tianyi_submissions
  set updated_at = now()
  where week_id = target_week_id
    and member_id = target_member_id
    and status = 'active';

  return coalesce(new, old);
end;
$$;

drop trigger if exists tianyi_attendance_refresh_scores on public.tianyi_attendance;
create trigger tianyi_attendance_refresh_scores
after insert or update or delete on public.tianyi_attendance
for each row execute function public.tianyi_refresh_attendance_scores();

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
    coalesce(bt.name, 'Buddy Pair ' || bt.team_no),
    array_remove(array_agg(distinct m.full_name order by m.full_name), null),
    coalesce(sum(s.score), 0)::bigint,
    coalesce(sum(case when s.tyfcb_status = 'approved' and s.status = 'active' then s.tyfcb else 0 end), 0),
    count(s.id) filter (where s.status = 'active')::bigint,
    dense_rank() over (order by coalesce(sum(s.score), 0) desc)
  from public.tianyi_buddy_teams bt
  left join public.tianyi_members m on m.buddy_team_id = bt.id and m.is_active = true
  left join public.tianyi_submissions s on s.member_id = m.id and s.status = 'active'
  where bt.is_active = true
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

create or replace function public.tianyi_archive_submission(
  p_submission_id uuid,
  p_reason text default null
)
returns public.tianyi_submissions
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.tianyi_submissions;
begin
  update public.tianyi_submissions
  set status = 'archived',
      archived_at = now(),
      archived_reason = p_reason,
      admin_note = coalesce(p_reason, admin_note)
  where id = p_submission_id
    and private.is_tianyi_admin()
  returning * into row;

  if row.id is null then
    raise exception 'Submission not found or not allowed.';
  end if;

  return row;
end;
$$;

create or replace function public.tianyi_assign_buddy_pair(
  p_member_id uuid,
  p_buddy_member_id uuid,
  p_team_no integer default null
)
returns public.tianyi_buddy_teams
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_team public.tianyi_buddy_teams;
begin
  if not private.is_tianyi_admin() then
    raise exception 'Not allowed.';
  end if;

  if p_member_id = p_buddy_member_id then
    raise exception 'A member cannot be their own buddy.';
  end if;

  if p_team_no is null then
    select bt.* into target_team
    from public.tianyi_buddy_teams bt
    where bt.is_active = true
      and (
        exists (select 1 from public.tianyi_members m where m.id in (p_member_id, p_buddy_member_id) and m.buddy_team_id = bt.id)
        or (select count(*) from public.tianyi_members m where m.buddy_team_id = bt.id and m.is_active = true) = 0
      )
    order by bt.team_no
    limit 1;
  else
    insert into public.tianyi_buddy_teams (team_no, name)
    values (p_team_no, 'Buddy Pair ' || p_team_no)
    on conflict (team_no) do update set is_active = true
    returning * into target_team;
  end if;

  if target_team.id is null then
    raise exception 'No available buddy pair found.';
  end if;

  update public.tianyi_members
  set buddy_team_id = target_team.id,
      buddy_member_id = case when id = p_member_id then p_buddy_member_id else p_member_id end,
      updated_at = now()
  where id in (p_member_id, p_buddy_member_id);

  update public.tianyi_members
  set buddy_team_id = null,
      buddy_member_id = null,
      updated_at = now()
  where buddy_team_id = target_team.id
    and id not in (p_member_id, p_buddy_member_id);

  return target_team;
end;
$$;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'tianyi-evidence';

drop policy if exists "Evidence files readable by signed in users" on storage.objects;
drop policy if exists "Evidence files readable by owner or admin" on storage.objects;
create policy "Evidence files readable by owner or admin" on storage.objects
for select using (
  bucket_id = 'tianyi-evidence'
  and (
    private.is_tianyi_admin()
    or (storage.foldername(name))[1] = private.current_member_id()::text
  )
);

revoke execute on function public.tianyi_archive_submission(uuid, text) from public;
revoke execute on function public.tianyi_assign_buddy_pair(uuid, uuid, integer) from public;
grant execute on function public.tianyi_archive_submission(uuid, text) to authenticated;
grant execute on function public.tianyi_assign_buddy_pair(uuid, uuid, integer) to authenticated;
