create or replace function tianyi.check_member_pair(p_member_id uuid, p_email text)
returns table(member_id uuid, full_name text, email text, buddy_team_id uuid, team_no integer)
language sql
security definer
set search_path = tianyi
stable
as $$
  select m.id, m.full_name, m.email, m.buddy_team_id, bt.team_no
  from tianyi.members m
  left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
  where m.id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
  limit 1
$$;

create or replace function tianyi.member_submission_history(p_member_id uuid, p_email text)
returns table(
  id uuid,
  member_id uuid,
  week_id integer,
  week_label text,
  score integer,
  status tianyi.tianyi_verification_status,
  submitted_at timestamptz
)
language sql
security definer
set search_path = tianyi
stable
as $$
  select s.id, s.member_id, s.week_id, w.label, s.score, s.status::tianyi.tianyi_verification_status, s.submitted_at
  from tianyi.submissions s
  join tianyi.members m on m.id = s.member_id
  join tianyi.weeks w on w.id = s.week_id
  where m.id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
  order by s.submitted_at desc
$$;

create or replace function tianyi.submit_weekly_update(
  p_member_id uuid,
  p_email text,
  p_week_id integer,
  p_one_to_one integer,
  p_training integer,
  p_referrals integer,
  p_tyfcb numeric,
  p_visitors integer
)
returns table(id uuid, score integer)
language plpgsql
security definer
set search_path = tianyi
as $$
declare
  member_row tianyi.members;
  target_week tianyi.weeks;
  current_week_id integer;
  created_submission tianyi.submissions;
begin
  select * into member_row
  from tianyi.members
  where id = p_member_id
    and lower(email) = lower(trim(p_email))
    and is_active = true
  limit 1;

  if member_row.id is null then
    raise exception 'Member and email do not match.';
  end if;

  select * into target_week from tianyi.weeks where id = p_week_id;
  if target_week.id is null then
    raise exception 'Selected week is not available.';
  end if;

  select w.id into current_week_id
  from tianyi.weeks w
  where current_date between w.starts_on and w.ends_on
  order by w.id
  limit 1;

  if current_date < date '2026-06-01' then
    if p_week_id <> 1 then
      raise exception 'Only week 1 is open during testing mode.';
    end if;
  elsif current_week_id is null then
    raise exception 'No submission week is currently open.';
  elsif p_week_id not in (current_week_id, greatest(1, current_week_id - 1)) then
    raise exception 'Only current week and last week are open.';
  end if;

  if exists (
    select 1
    from tianyi.submissions s
    where s.member_id = p_member_id
      and s.week_id = p_week_id
      and s.status <> 'archived'
  ) then
    raise exception 'This week was already submitted.';
  end if;

  insert into tianyi.submissions (
    member_id,
    week_id,
    one_to_one,
    training,
    referrals,
    tyfcb,
    visitors,
    visitor_joined
  )
  values (
    p_member_id,
    p_week_id,
    greatest(coalesce(p_one_to_one, 0), 0),
    greatest(coalesce(p_training, 0), 0),
    greatest(coalesce(p_referrals, 0), 0),
    greatest(coalesce(p_tyfcb, 0), 0),
    greatest(coalesce(p_visitors, 0), 0),
    0
  )
  returning * into created_submission;

  return query select created_submission.id, created_submission.score;
end;
$$;

create or replace function tianyi.add_submission_evidence(
  p_submission_id uuid,
  p_member_id uuid,
  p_email text,
  p_kind text,
  p_file_path text,
  p_file_name text
)
returns uuid
language plpgsql
security definer
set search_path = tianyi
as $$
declare
  evidence_id uuid;
begin
  if p_kind not in ('one_to_one', 'training', 'referral', 'tyfcb', 'visitor') then
    raise exception 'Invalid evidence kind.';
  end if;

  if not exists (
    select 1
    from tianyi.submissions s
    join tianyi.members m on m.id = s.member_id
    where s.id = p_submission_id
      and s.member_id = p_member_id
      and lower(m.email) = lower(trim(p_email))
      and m.is_active = true
      and p_file_path like p_member_id::text || '/' || p_submission_id::text || '/%'
  ) then
    raise exception 'Evidence does not match this member submission.';
  end if;

  insert into tianyi.evidence (submission_id, kind, file_path, file_name)
  values (p_submission_id, p_kind, p_file_path, p_file_name)
  returning id into evidence_id;

  return evidence_id;
end;
$$;

drop policy if exists "Anon can upload Tianyi evidence after pair check" on storage.objects;
create policy "Anon can upload Tianyi evidence after pair check" on storage.objects
for insert to anon
with check (
  bucket_id = 'tianyi-onesystem-evidence'
  and exists (
    select 1
    from tianyi.members m
    where m.id::text = (storage.foldername(name))[1]
      and m.is_active = true
  )
);

revoke execute on function tianyi.member_submission_history(uuid, text) from public;
revoke execute on function tianyi.check_member_pair(uuid, text) from public;
revoke execute on function tianyi.submit_weekly_update(uuid, text, integer, integer, integer, integer, numeric, integer) from public;
revoke execute on function tianyi.add_submission_evidence(uuid, uuid, text, text, text, text) from public;
grant execute on function tianyi.member_submission_history(uuid, text) to anon, authenticated;
grant execute on function tianyi.check_member_pair(uuid, text) to anon, authenticated;
grant execute on function tianyi.submit_weekly_update(uuid, text, integer, integer, integer, integer, numeric, integer) to anon, authenticated;
grant execute on function tianyi.add_submission_evidence(uuid, uuid, text, text, text, text) to anon, authenticated;
