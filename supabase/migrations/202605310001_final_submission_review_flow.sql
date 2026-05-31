alter table tianyi.submissions
add column if not exists review_status text not null default 'reviewing'
check (review_status in ('reviewing', 'approved', 'rejected'));

update tianyi.submissions s
set review_status = case
  when s.status = 'active'
    and (
      (s.one_to_one > 0 or s.training > 0 or s.referrals > 0 or s.tyfcb > 0 or s.visitors > 0)
    )
    and (s.one_to_one <= 0 or s.one_to_one_status = 'approved')
    and (s.training <= 0 or s.training_status = 'approved')
    and (s.referrals <= 0 or s.referral_status = 'approved')
    and (s.tyfcb <= 0 or s.tyfcb_status = 'approved')
    and (s.visitors <= 0 or s.visitor_status = 'approved')
    then 'approved'
  else 'reviewing'
end
where s.review_status = 'reviewing';

create or replace function tianyi.set_submission_score()
returns trigger
language plpgsql
set search_path = tianyi
as $$
declare
  approved_one_to_one integer;
  approved_training integer;
  approved_referrals integer;
  approved_tyfcb numeric;
  approved_visitors integer;
  approved_visitor_joined integer;
begin
  new.admin_bonus_points := greatest(coalesce(new.admin_bonus_points, 0), 0);
  new.attended := false;
  new.full_attendance_bonus := false;
  new.monthly_completion_bonus_points := 0;
  new.review_status := coalesce(new.review_status, 'reviewing');

  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
    new.score := 0;
    new.updated_at := now();
    return new;
  end if;

  if new.review_status <> 'approved' then
    new.score := 0;
    new.updated_at := now();
    return new;
  end if;

  approved_one_to_one := case when new.one_to_one_status = 'approved' then new.one_to_one else 0 end;
  approved_training := case when new.training_status = 'approved' then new.training else 0 end;
  approved_referrals := case when new.referral_status = 'approved' then new.referrals else 0 end;
  approved_tyfcb := case when new.tyfcb_status = 'approved' then new.tyfcb else 0 end;
  approved_visitors := case when new.visitor_status = 'approved' then new.visitors else 0 end;
  approved_visitor_joined := case when new.visitor_status = 'approved' then new.visitor_joined else 0 end;

  new.score :=
    tianyi.score(approved_one_to_one, approved_training, approved_referrals, approved_tyfcb, approved_visitors, approved_visitor_joined, false)
    + new.admin_bonus_points;
  new.updated_at := now();
  return new;
end;
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
set search_path = tianyi, tianyi_private
as $$
declare
  member_row tianyi.members;
  target_week tianyi.weeks;
  current_week_id integer;
  created_submission tianyi.submissions;
  existing_submission tianyi.submissions;
  log_action text;
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
      review_status = 'reviewing',
      submitted_at = now(),
      updated_at = now()
    where tianyi.submissions.id = existing_submission.id
    returning * into created_submission;

    log_action := 'member_update_submission';
  else
    insert into tianyi.submissions (
      member_id,
      week_id,
      one_to_one,
      training,
      referrals,
      tyfcb,
      visitors,
      visitor_joined,
      review_status
    )
    values (
      p_member_id,
      p_week_id,
      greatest(coalesce(p_one_to_one, 0), 0),
      greatest(coalesce(p_training, 0), 0),
      greatest(coalesce(p_referrals, 0), 0),
      greatest(coalesce(p_tyfcb, 0), 0),
      greatest(coalesce(p_visitors, 0), 0),
      0,
      'reviewing'
    )
    returning * into created_submission;

    log_action := 'member_submit';
  end if;

  perform tianyi_private.log_action(
    'member',
    member_row.email,
    log_action,
    'submission',
    created_submission.id,
    member_row.id,
    created_submission.id,
    created_submission.week_id,
    jsonb_build_object(
      'one_to_one', created_submission.one_to_one,
      'training', created_submission.training,
      'referrals', created_submission.referrals,
      'tyfcb', created_submission.tyfcb,
      'visitors', created_submission.visitors
    )
  );

  return query select created_submission.id, created_submission.score;
end;
$$;

create or replace function tianyi.admin_review_submission_section(
  p_token text,
  p_submission_id uuid,
  p_field text,
  p_value text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
  clean_reason text;
  evidence_kind text;
  submitted_value numeric;
  team_id uuid;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;
  if p_field not in ('one_to_one_status', 'training_status', 'referral_status', 'tyfcb_status', 'visitor_status') then
    raise exception 'Invalid submission field.';
  end if;
  if p_value not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid submission status.';
  end if;

  select * into submission_row
  from tianyi.submissions
  where id = p_submission_id;

  if submission_row.id is null then
    return false;
  end if;

  evidence_kind := case p_field
    when 'one_to_one_status' then 'one_to_one'
    when 'training_status' then 'training'
    when 'referral_status' then 'referral'
    when 'tyfcb_status' then 'tyfcb'
    when 'visitor_status' then 'visitor'
  end;

  submitted_value := case p_field
    when 'one_to_one_status' then submission_row.one_to_one
    when 'training_status' then submission_row.training
    when 'referral_status' then submission_row.referrals
    when 'tyfcb_status' then submission_row.tyfcb
    when 'visitor_status' then submission_row.visitors
    else 0
  end;

  if p_value = 'approved'
    and submitted_value > 0
    and not exists (
      select 1
      from tianyi.evidence e
      where e.submission_id = p_submission_id
        and e.kind = evidence_kind
    )
  then
    raise exception 'Cannot approve without proof image.';
  end if;

  clean_reason := nullif(trim(coalesce(p_reason, '')), '');

  execute format(
    'update tianyi.submissions set %I = $1::tianyi.tianyi_verification_status, review_status = ''reviewing'', admin_note = case when $1 = ''rejected'' and $3 is not null then concat_ws(E''\n'', nullif(admin_note, ''''), $3) else admin_note end where id = $2 returning *',
    p_field
  )
    into submission_row
    using p_value, p_submission_id, clean_reason;

  if submission_row.id is not null then
    select m.buddy_team_id into team_id from tianyi.members m where m.id = submission_row.member_id;
    perform tianyi.recalculate_team_bonus_awards(team_id);
    perform tianyi_private.log_action(
      'admin',
      actor_email,
      case when p_value = 'approved' then 'admin_approve' when p_value = 'rejected' then 'admin_reject_status' else 'admin_set_pending' end,
      'submission',
      p_submission_id,
      submission_row.member_id,
      p_submission_id,
      submission_row.week_id,
      jsonb_build_object('field', p_field, 'status', p_value, 'reason', clean_reason)
    );
  end if;

  return submission_row.id is not null;
end;
$$;

create or replace function tianyi.admin_finalize_submission_review(
  p_token text,
  p_submission_id uuid,
  p_value text
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
  submitted_count integer;
  pending_count integer;
  rejected_count integer;
  unapproved_count integer;
  team_id uuid;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;
  if p_value not in ('approved', 'rejected') then
    raise exception 'Invalid final review status.';
  end if;

  select * into submission_row
  from tianyi.submissions
  where id = p_submission_id
    and status = 'active';

  if submission_row.id is null then
    return false;
  end if;

  submitted_count :=
    case when submission_row.one_to_one > 0 then 1 else 0 end +
    case when submission_row.training > 0 then 1 else 0 end +
    case when submission_row.referrals > 0 then 1 else 0 end +
    case when submission_row.tyfcb > 0 then 1 else 0 end +
    case when submission_row.visitors > 0 then 1 else 0 end;

  pending_count :=
    case when submission_row.one_to_one > 0 and submission_row.one_to_one_status = 'pending' then 1 else 0 end +
    case when submission_row.training > 0 and submission_row.training_status = 'pending' then 1 else 0 end +
    case when submission_row.referrals > 0 and submission_row.referral_status = 'pending' then 1 else 0 end +
    case when submission_row.tyfcb > 0 and submission_row.tyfcb_status = 'pending' then 1 else 0 end +
    case when submission_row.visitors > 0 and submission_row.visitor_status = 'pending' then 1 else 0 end;

  rejected_count :=
    case when submission_row.one_to_one > 0 and submission_row.one_to_one_status = 'rejected' then 1 else 0 end +
    case when submission_row.training > 0 and submission_row.training_status = 'rejected' then 1 else 0 end +
    case when submission_row.referrals > 0 and submission_row.referral_status = 'rejected' then 1 else 0 end +
    case when submission_row.tyfcb > 0 and submission_row.tyfcb_status = 'rejected' then 1 else 0 end +
    case when submission_row.visitors > 0 and submission_row.visitor_status = 'rejected' then 1 else 0 end;

  unapproved_count :=
    case when submission_row.one_to_one > 0 and submission_row.one_to_one_status <> 'approved' then 1 else 0 end +
    case when submission_row.training > 0 and submission_row.training_status <> 'approved' then 1 else 0 end +
    case when submission_row.referrals > 0 and submission_row.referral_status <> 'approved' then 1 else 0 end +
    case when submission_row.tyfcb > 0 and submission_row.tyfcb_status <> 'approved' then 1 else 0 end +
    case when submission_row.visitors > 0 and submission_row.visitor_status <> 'approved' then 1 else 0 end;

  if pending_count > 0 then
    raise exception 'Finish all section reviews first.';
  end if;

  if p_value = 'approved' and unapproved_count > 0 then
    raise exception 'Only fully approved submissions can be finalized as approved.';
  end if;

  if p_value = 'rejected' and rejected_count = 0 then
    raise exception 'Rejected final status requires at least one rejected section.';
  end if;

  update tianyi.submissions
  set review_status = p_value,
      updated_at = now()
  where id = p_submission_id
  returning * into submission_row;

  select m.buddy_team_id into team_id
  from tianyi.members m
  where m.id = submission_row.member_id;

  perform tianyi.recalculate_team_bonus_awards(team_id);
  perform tianyi_private.log_action(
    'admin',
    actor_email,
    case when p_value = 'approved' then 'admin_finalize_approved' else 'admin_finalize_rejected' end,
    'submission',
    p_submission_id,
    submission_row.member_id,
    p_submission_id,
    submission_row.week_id,
    jsonb_build_object(
      'review_status', p_value,
      'submitted_sections', submitted_count,
      'rejected_sections', rejected_count
    )
  );

  return true;
end;
$$;

create or replace function tianyi.recalculate_team_bonus_awards(p_buddy_team_id uuid)
returns void
language plpgsql
security definer
set search_path = tianyi
as $$
declare
  active_member_count integer;
begin
  if p_buddy_team_id is null then
    return;
  end if;

  select count(*) into active_member_count
  from tianyi.members m
  where m.buddy_team_id = p_buddy_team_id
    and m.is_active = true;

  delete from tianyi.team_bonus_awards
  where buddy_team_id = p_buddy_team_id;

  if active_member_count < 2 then
    return;
  end if;

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with member_month as (
    select
      m.id as member_id,
      w.month,
      max(w.id) as award_week_id,
      coalesce(sum(case when s.review_status = 'approved' and s.one_to_one_status = 'approved' then s.one_to_one else 0 end), 0) as one_to_one_total,
      coalesce(sum(case when s.review_status = 'approved' and s.training_status = 'approved' then s.training else 0 end), 0) as training_total,
      coalesce(sum(case when s.review_status = 'approved' and s.referral_status = 'approved' then s.referrals else 0 end), 0) as referral_total,
      coalesce(sum(case when s.review_status = 'approved' and s.tyfcb_status = 'approved' then s.tyfcb else 0 end), 0) as tyfcb_total,
      coalesce(sum(case when s.review_status = 'approved' and s.visitor_status = 'approved' then s.visitors else 0 end), 0) as visitor_total
    from tianyi.members m
    cross join (select distinct month from tianyi.weeks) w_months(month)
    join tianyi.weeks w on w.month = w_months.month
    left join tianyi.submissions s
      on s.member_id = m.id
      and s.week_id = w.id
      and s.status = 'active'
    where m.buddy_team_id = p_buddy_team_id
      and m.is_active = true
    group by m.id, w.month
  ),
  qualified_month as (
    select
      month,
      max(award_week_id) as award_week_id,
      count(*) filter (
        where one_to_one_total > 0
          and training_total > 0
          and referral_total > 0
          and tyfcb_total > 0
          and visitor_total > 0
      ) as qualified_members
    from member_month
    group by month
  )
  select p_buddy_team_id, 'all_five_buddy_monthly', 3, award_week_id, month, 'Both buddy members completed all five approved sections in the month.'
  from qualified_month
  where qualified_members >= 2
  on conflict (buddy_team_id, bonus_type, period_key)
  do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with week_visitors as (
    select
      s.week_id,
      count(distinct s.member_id) filter (where s.review_status = 'approved' and s.visitor_status = 'approved' and s.visitors > 0) as members_with_visitor
    from tianyi.submissions s
    join tianyi.members m on m.id = s.member_id
    where m.buddy_team_id = p_buddy_team_id
      and m.is_active = true
      and s.status = 'active'
    group by s.week_id
  )
  select p_buddy_team_id, 'both_buddies_visitor_weekly', 5, week_id, 'week-' || week_id, 'Both buddy members had at least one approved Visitor in the same week.'
  from week_visitors
  where members_with_visitor >= 2
  on conflict (buddy_team_id, bonus_type, period_key)
  do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with week_totals as (
    select
      w.id as week_id,
      coalesce(sum(case when s.review_status = 'approved' and s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total
    from tianyi.weeks w
    left join tianyi.submissions s on s.week_id = w.id
    left join tianyi.members m on m.id = s.member_id and m.buddy_team_id = p_buddy_team_id and m.is_active = true
    where m.id is not null or s.id is null
    group by w.id
  ),
  windows as (
    select
      w2.week_id as end_week_id,
      w2.visitor_total + coalesce(w1.visitor_total, 0) as two_week_visitors
    from week_totals w2
    left join week_totals w1 on w1.week_id = w2.week_id - 1
  )
  select p_buddy_team_id, 'four_visitor_two_week', 10, end_week_id, 'weeks-' || (end_week_id - 1) || '-' || end_week_id, 'Buddy team reached 4 approved Visitors across a two-week window.'
  from windows
  where end_week_id > 1
    and two_week_visitors >= 4
  on conflict (buddy_team_id, bonus_type, period_key)
  do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with team_members as (
    select id
    from tianyi.members
    where buddy_team_id = p_buddy_team_id
      and is_active = true
  ),
  weeks_to_check as (
    select id as award_week_id
    from tianyi.weeks
    where id > 2
  ),
  member_windows as (
    select
      w.award_week_id,
      tm.id as member_id,
      count(distinct s.week_id) filter (where s.id is not null) as submitted_weeks,
      coalesce(sum(case when s.review_status = 'approved' and s.referral_status = 'approved' and s.status = 'active' then s.referrals else 0 end), 0) as referral_total,
      coalesce(sum(case when s.review_status = 'approved' and s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total
    from weeks_to_check w
    cross join team_members tm
    left join tianyi.submissions s
      on s.member_id = tm.id
      and s.week_id in (w.award_week_id - 2, w.award_week_id - 1)
      and s.status = 'active'
    group by w.award_week_id, tm.id
  ),
  rescue_windows as (
    select
      weak.award_week_id,
      weak.member_id as weak_member_id,
      helper.member_id as helper_member_id
    from member_windows weak
    join member_windows helper
      on helper.award_week_id = weak.award_week_id
      and helper.member_id <> weak.member_id
    where weak.submitted_weeks = 2
      and weak.referral_total = 0
      and weak.visitor_total = 0
      and (helper.visitor_total > 0 or helper.referral_total >= 3)
  )
  select p_buddy_team_id, 'rescue_teammate', 5, award_week_id, 'rescue-' || (award_week_id - 2) || '-' || (award_week_id - 1) || '-' || award_week_id, 'One buddy had no Referral and Visitor for two submitted weeks while the other brought Visitor or 3 Referrals.'
  from rescue_windows
  on conflict (buddy_team_id, bonus_type, period_key)
  do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();
end;
$$;

create or replace function tianyi.team_leaderboard()
returns table(
  team_id uuid,
  team_no integer,
  team_name text,
  members text[],
  total_score bigint,
  member_score bigint,
  team_bonus_points bigint,
  total_tyfcb numeric,
  submission_count bigint,
  rank bigint
)
language sql
security invoker
set search_path = tianyi
stable
as $$
  with member_scores as (
    select
      bt.id as team_id,
      coalesce(sum(case when s.review_status = 'approved' then s.score else 0 end), 0)::bigint as member_score,
      coalesce(sum(case when s.review_status = 'approved' and s.tyfcb_status = 'approved' and s.status = 'active' then s.tyfcb else 0 end), 0) as total_tyfcb,
      count(s.id) filter (where s.status = 'active')::bigint as submission_count
    from tianyi.buddy_teams bt
    left join tianyi.members m on m.buddy_team_id = bt.id and m.is_active = true
    left join tianyi.submissions s on s.member_id = m.id and s.status = 'active'
    where bt.is_active = true
    group by bt.id
  ),
  bonus_scores as (
    select
      buddy_team_id as team_id,
      coalesce(sum(points), 0)::bigint as team_bonus_points
    from tianyi.team_bonus_awards
    group by buddy_team_id
  )
  select
    bt.id,
    bt.team_no,
    coalesce(bt.name, 'Buddy Pair ' || bt.team_no),
    array_remove(array_agg(distinct m.full_name order by m.full_name), null),
    (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0))::bigint as total_score,
    coalesce(ms.member_score, 0)::bigint as member_score,
    coalesce(bs.team_bonus_points, 0)::bigint as team_bonus_points,
    coalesce(ms.total_tyfcb, 0),
    coalesce(ms.submission_count, 0)::bigint as submission_count,
    dense_rank() over (order by (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0)) desc)
  from tianyi.buddy_teams bt
  left join tianyi.members m on m.buddy_team_id = bt.id and m.is_active = true
  left join member_scores ms on ms.team_id = bt.id
  left join bonus_scores bs on bs.team_id = bt.id
  where bt.is_active = true
  group by bt.id, bt.team_no, bt.name, ms.member_score, bs.team_bonus_points, ms.total_tyfcb, ms.submission_count
  order by (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0)) desc, bt.team_no asc
$$;

revoke execute on function tianyi.admin_finalize_submission_review(text, uuid, text) from public;
grant execute on function tianyi.admin_finalize_submission_review(text, uuid, text) to anon, authenticated;

update tianyi.submissions
set updated_at = now()
where status = 'active';

do $$
declare
  team record;
begin
  for team in select id from tianyi.buddy_teams where is_active = true loop
    perform tianyi.recalculate_team_bonus_awards(team.id);
  end loop;
end;
$$;
