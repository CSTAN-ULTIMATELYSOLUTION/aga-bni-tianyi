update tianyi.weeks as w
set
  label = v.label,
  starts_on = v.starts_on::date,
  ends_on = v.ends_on::date,
  month = v.month
from (values
  (1, 'Week 1 (02/06 - 08/06)', '2026-06-02', '2026-06-08', 'June'),
  (2, 'Week 2 (09/06 - 15/06)', '2026-06-09', '2026-06-15', 'June'),
  (3, 'Week 3 (16/06 - 22/06)', '2026-06-16', '2026-06-22', 'June'),
  (4, 'Week 4 (23/06 - 29/06)', '2026-06-23', '2026-06-29', 'June'),
  (5, 'Week 5 (30/06 - 06/07)', '2026-06-30', '2026-07-06', 'July'),
  (6, 'Week 6 (07/07 - 13/07)', '2026-07-07', '2026-07-13', 'July'),
  (7, 'Week 7 (14/07 - 20/07)', '2026-07-14', '2026-07-20', 'July'),
  (8, 'Week 8 (21/07 - 27/07)', '2026-07-21', '2026-07-27', 'July'),
  (9, 'Week 9 (28/07 - 03/08)', '2026-07-28', '2026-08-03', 'July')
) as v(id, label, starts_on, ends_on, month)
where w.id = v.id;

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
