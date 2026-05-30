update tianyi.weeks as w
set
  label = v.label,
  starts_on = v.starts_on::date,
  ends_on = v.ends_on::date,
  month = v.month
from (values
  (9, 'Week 9 (28/07 - 31/07)', '2026-07-28', '2026-07-31', 'July')
) as v(id, label, starts_on, ends_on, month)
where w.id = v.id;

create table if not exists tianyi.team_bonus_awards (
  id uuid primary key default gen_random_uuid(),
  buddy_team_id uuid not null references tianyi.buddy_teams(id) on delete cascade,
  bonus_type text not null check (bonus_type in (
    'all_five_buddy_monthly',
    'both_buddies_visitor_weekly',
    'four_visitor_two_week',
    'rescue_teammate'
  )),
  points integer not null check (points > 0),
  week_id integer references tianyi.weeks(id),
  period_key text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buddy_team_id, bonus_type, period_key)
);

alter table tianyi.team_bonus_awards enable row level security;

drop policy if exists "Team bonus awards are readable" on tianyi.team_bonus_awards;
create policy "Team bonus awards are readable" on tianyi.team_bonus_awards
for select using (true);

grant select on tianyi.team_bonus_awards to anon, authenticated;

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

  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
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
      coalesce(sum(case when s.one_to_one_status = 'approved' then s.one_to_one else 0 end), 0) as one_to_one_total,
      coalesce(sum(case when s.training_status = 'approved' then s.training else 0 end), 0) as training_total,
      coalesce(sum(case when s.referral_status = 'approved' then s.referrals else 0 end), 0) as referral_total,
      coalesce(sum(case when s.tyfcb_status = 'approved' then s.tyfcb else 0 end), 0) as tyfcb_total,
      coalesce(sum(case when s.visitor_status = 'approved' then s.visitors else 0 end), 0) as visitor_total
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
      ) as completed_members
    from member_month
    group by month
  )
  select
    p_buddy_team_id,
    'all_five_buddy_monthly',
    3,
    award_week_id,
    'month:' || month,
    'Both buddy members completed all five approved sections in the month.'
  from qualified_month
  where completed_members = active_member_count
  on conflict (buddy_team_id, bonus_type, period_key) do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with member_week_visitors as (
    select
      w.id as week_id,
      m.id as member_id,
      coalesce(sum(case when s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total
    from tianyi.weeks w
    cross join tianyi.members m
    left join tianyi.submissions s
      on s.week_id = w.id
      and s.member_id = m.id
    where m.buddy_team_id = p_buddy_team_id
      and m.is_active = true
    group by w.id, m.id
  ),
  qualified_week as (
    select week_id
    from member_week_visitors
    group by week_id
    having count(*) filter (where visitor_total > 0) = active_member_count
  )
  select
    p_buddy_team_id,
    'both_buddies_visitor_weekly',
    5,
    week_id,
    'week:' || week_id,
    'Both buddy members had at least one approved visitor in the same week.'
  from qualified_week
  on conflict (buddy_team_id, bonus_type, period_key) do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with week_pairs as (
    select w1.id as start_week_id, w2.id as end_week_id
    from tianyi.weeks w1
    join tianyi.weeks w2 on w2.id = w1.id + 1
  ),
  pair_visitors as (
    select
      wp.start_week_id,
      wp.end_week_id,
      coalesce(sum(case when s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total
    from week_pairs wp
    left join tianyi.submissions s
      on s.week_id in (wp.start_week_id, wp.end_week_id)
    left join tianyi.members m
      on m.id = s.member_id
      and m.buddy_team_id = p_buddy_team_id
      and m.is_active = true
    where m.id is not null
    group by wp.start_week_id, wp.end_week_id
  )
  select
    p_buddy_team_id,
    'four_visitor_two_week',
    10,
    end_week_id,
    'weeks:' || start_week_id || '-' || end_week_id,
    'Buddy team had at least four approved visitors across the two-week window.'
  from pair_visitors
  where visitor_total >= 4
  on conflict (buddy_team_id, bonus_type, period_key) do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with award_weeks as (
    select id as award_week_id, id - 2 as start_week_id, id - 1 as end_week_id
    from tianyi.weeks
    where id >= 3
  ),
  member_window as (
    select
      aw.award_week_id,
      aw.start_week_id,
      aw.end_week_id,
      m.id as member_id,
      coalesce(sum(case when s.referral_status = 'approved' and s.status = 'active' then s.referrals else 0 end), 0) as referral_total,
      coalesce(sum(case when s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total,
      count(distinct s.week_id) filter (where s.status = 'active') as submitted_weeks
    from award_weeks aw
    cross join tianyi.members m
    left join tianyi.submissions s
      on s.member_id = m.id
      and s.week_id in (aw.start_week_id, aw.end_week_id)
    where m.buddy_team_id = p_buddy_team_id
      and m.is_active = true
    group by aw.award_week_id, aw.start_week_id, aw.end_week_id, m.id
  ),
  qualified_rescue as (
    select distinct weak.award_week_id, weak.start_week_id, weak.end_week_id
    from member_window weak
    join member_window helper
      on helper.award_week_id = weak.award_week_id
      and helper.member_id <> weak.member_id
    where weak.referral_total = 0
      and weak.visitor_total = 0
      and weak.submitted_weeks = 2
      and (helper.visitor_total > 0 or helper.referral_total >= 3)
  )
  select
    p_buddy_team_id,
    'rescue_teammate',
    5,
    award_week_id,
    'rescue:' || start_week_id || '-' || end_week_id || ':' || award_week_id,
    'One buddy had zero approved referrals and visitors in the previous two weeks while the other carried visitors or referrals.'
  from qualified_rescue
  on conflict (buddy_team_id, bonus_type, period_key) do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();
end;
$$;

create or replace function tianyi.recalculate_all_team_bonus_awards()
returns void
language plpgsql
security definer
set search_path = tianyi
as $$
declare
  team_row record;
begin
  for team_row in
    select id from tianyi.buddy_teams where is_active = true
  loop
    perform tianyi.recalculate_team_bonus_awards(team_row.id);
  end loop;
end;
$$;

create or replace function tianyi.refresh_team_bonus_awards_for_submission()
returns trigger
language plpgsql
set search_path = tianyi
as $$
declare
  old_team_id uuid;
  new_team_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select buddy_team_id into old_team_id from tianyi.members where id = old.member_id;
    perform tianyi.recalculate_team_bonus_awards(old_team_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select buddy_team_id into new_team_id from tianyi.members where id = new.member_id;
    if new_team_id is distinct from old_team_id then
      perform tianyi.recalculate_team_bonus_awards(new_team_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists team_bonus_after_submission_write on tianyi.submissions;
create trigger team_bonus_after_submission_write
after insert or update or delete on tianyi.submissions
for each row execute function tianyi.refresh_team_bonus_awards_for_submission();

create or replace function tianyi.refresh_team_bonus_awards_for_member()
returns trigger
language plpgsql
set search_path = tianyi
as $$
begin
  if old.buddy_team_id is not null then
    perform tianyi.recalculate_team_bonus_awards(old.buddy_team_id);
  end if;
  if new.buddy_team_id is not null and new.buddy_team_id is distinct from old.buddy_team_id then
    perform tianyi.recalculate_team_bonus_awards(new.buddy_team_id);
  end if;
  return new;
end;
$$;

drop trigger if exists team_bonus_after_member_team_change on tianyi.members;
create trigger team_bonus_after_member_team_change
after update of buddy_team_id, is_active on tianyi.members
for each row execute function tianyi.refresh_team_bonus_awards_for_member();

drop function if exists tianyi.team_leaderboard();
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
security definer
set search_path = tianyi
stable
as $$
  with member_scores as (
    select
      bt.id as team_id,
      coalesce(sum(s.score), 0)::bigint as member_score,
      coalesce(sum(case when s.tyfcb_status = 'approved' and s.status = 'active' then s.tyfcb else 0 end), 0) as total_tyfcb,
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
    coalesce(ms.submission_count, 0)::bigint,
    dense_rank() over (order by (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0)) desc)
  from tianyi.buddy_teams bt
  left join tianyi.members m on m.buddy_team_id = bt.id and m.is_active = true
  left join member_scores ms on ms.team_id = bt.id
  left join bonus_scores bs on bs.team_id = bt.id
  where bt.is_active = true
  group by bt.id, bt.team_no, bt.name, ms.member_score, bs.team_bonus_points, ms.total_tyfcb, ms.submission_count
  order by (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0)) desc, bt.team_no asc
$$;

create or replace function tianyi.admin_submissions(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then coalesce(jsonb_agg(
    to_jsonb(sd) || jsonb_build_object(
      'evidence', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from tianyi.evidence e where e.submission_id = sd.id), '[]'::jsonb),
      'team_bonus_awards', coalesce((select jsonb_agg(to_jsonb(tba) order by tba.week_id, tba.bonus_type) from tianyi.team_bonus_awards tba where tba.buddy_team_id = sd.buddy_team_id), '[]'::jsonb)
    )
    order by sd.submitted_at desc
  ), '[]'::jsonb) else null end
  from tianyi.submission_details sd
$$;

grant execute on function tianyi.recalculate_team_bonus_awards(uuid) to anon, authenticated;
grant execute on function tianyi.recalculate_all_team_bonus_awards() to anon, authenticated;
grant execute on function tianyi.team_leaderboard() to anon, authenticated;
revoke execute on function tianyi.admin_submissions(text) from public;
grant execute on function tianyi.admin_submissions(text) to anon, authenticated;

update tianyi.submissions
set updated_at = now()
where status = 'active';

select tianyi.recalculate_all_team_bonus_awards();
