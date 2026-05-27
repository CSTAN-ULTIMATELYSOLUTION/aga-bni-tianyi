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
  existing_submission tianyi.submissions;
begin
  select * into member_row
  from tianyi.members m
  where m.id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
  limit 1;

  if member_row.id is null then
    raise exception 'Member and email do not match.';
  end if;

  select * into target_week
  from tianyi.weeks w
  where w.id = p_week_id;

  if target_week.id is null then
    raise exception 'Selected week is not available.';
  end if;

  select w.id into current_week_id
  from tianyi.weeks w
  where current_date between w.starts_on and w.ends_on
  order by w.id
  limit 1;

  if current_date < date '2026-06-02' then
    if p_week_id <> 1 then
      raise exception 'Only week 1 is open during testing mode.';
    end if;
  elsif current_week_id is null then
    raise exception 'No submission week is currently open.';
  elsif p_week_id not in (current_week_id, greatest(1, current_week_id - 1)) then
    raise exception 'Only current week and last week are open.';
  end if;

  select * into existing_submission
  from tianyi.submissions s
  where s.member_id = p_member_id
    and s.week_id = p_week_id
    and s.status <> 'archived'
  limit 1;

  if existing_submission.id is not null then
    if current_date > target_week.ends_on + 14 then
      raise exception 'This week is locked.';
    end if;

    update tianyi.submissions
    set
      one_to_one = greatest(coalesce(p_one_to_one, 0), 0),
      training = greatest(coalesce(p_training, 0), 0),
      referrals = greatest(coalesce(p_referrals, 0), 0),
      tyfcb = greatest(coalesce(p_tyfcb, 0), 0),
      visitors = greatest(coalesce(p_visitors, 0), 0),
      one_to_one_status = 'pending',
      training_status = 'pending',
      referral_status = 'pending',
      tyfcb_status = 'pending',
      visitor_status = 'pending',
      submitted_at = now(),
      updated_at = now()
    where tianyi.submissions.id = existing_submission.id
    returning * into created_submission;

    return query select created_submission.id, created_submission.score;
    return;
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
