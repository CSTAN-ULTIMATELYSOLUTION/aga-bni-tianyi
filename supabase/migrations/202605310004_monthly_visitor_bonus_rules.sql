alter table tianyi.team_bonus_awards
drop constraint if exists team_bonus_awards_bonus_type_check;

delete from tianyi.team_bonus_awards
where bonus_type in ('both_buddies_visitor_weekly', 'four_visitor_two_week');

alter table tianyi.team_bonus_awards
add constraint team_bonus_awards_bonus_type_check
check (bonus_type in (
  'all_five_buddy_monthly',
  'monthly_visitor_2',
  'monthly_visitor_4',
  'rescue_teammate'
));

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
  with campaign_weeks as (
    select id, case when id <= 4 then 'month-1' else 'month-2' end as period_key
    from tianyi.weeks
  ),
  member_month as (
    select
      m.id as member_id,
      cw.period_key,
      max(cw.id) as award_week_id,
      coalesce(sum(case when s.review_status = 'approved' and s.one_to_one_status = 'approved' then s.one_to_one else 0 end), 0) as one_to_one_total,
      coalesce(sum(case when s.review_status = 'approved' and s.training_status = 'approved' then s.training else 0 end), 0) as training_total,
      coalesce(sum(case when s.review_status = 'approved' and s.referral_status = 'approved' then s.referrals else 0 end), 0) as referral_total,
      coalesce(sum(case when s.review_status = 'approved' and s.tyfcb_status = 'approved' then s.tyfcb else 0 end), 0) as tyfcb_total,
      coalesce(sum(case when s.review_status = 'approved' and s.visitor_status = 'approved' then s.visitors else 0 end), 0) as visitor_total
    from tianyi.members m
    cross join campaign_weeks cw
    left join tianyi.submissions s
      on s.member_id = m.id
      and s.week_id = cw.id
      and s.status = 'active'
    where m.buddy_team_id = p_buddy_team_id
      and m.is_active = true
    group by m.id, cw.period_key
  ),
  qualified_month as (
    select
      period_key,
      max(award_week_id) as award_week_id,
      count(*) filter (
        where one_to_one_total > 0
          and training_total > 0
          and referral_total > 0
          and tyfcb_total > 0
          and visitor_total > 0
      ) as qualified_members
    from member_month
    group by period_key
  )
  select p_buddy_team_id, 'all_five_buddy_monthly', 3, award_week_id, period_key, 'Both buddy members completed all five approved sections in the campaign month.'
  from qualified_month
  where qualified_members >= 2
  on conflict (buddy_team_id, bonus_type, period_key)
  do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();

  insert into tianyi.team_bonus_awards (buddy_team_id, bonus_type, points, week_id, period_key, reason)
  with campaign_weeks as (
    select id, case when id <= 4 then 'month-1' else 'month-2' end as period_key
    from tianyi.weeks
  ),
  monthly_visitors as (
    select
      cw.period_key,
      max(cw.id) as award_week_id,
      coalesce(sum(case when s.review_status = 'approved' and s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total
    from campaign_weeks cw
    left join tianyi.submissions s
      on s.week_id = cw.id
      and s.status = 'active'
      and exists (
        select 1
        from tianyi.members m
        where m.id = s.member_id
          and m.buddy_team_id = p_buddy_team_id
          and m.is_active = true
      )
    group by cw.period_key
  )
  select
    p_buddy_team_id,
    case when visitor_total >= 4 then 'monthly_visitor_4' else 'monthly_visitor_2' end,
    case when visitor_total >= 4 then 10 else 5 end,
    award_week_id,
    period_key,
    case when visitor_total >= 4
      then 'Buddy team reached 4 approved Visitors in the campaign month.'
      else 'Buddy team reached 2 approved Visitors in the campaign month.'
    end
  from monthly_visitors
  where visitor_total >= 2
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
      coalesce(sum(case when s.review_status = 'approved' and s.visitor_status = 'approved' and s.status = 'active' then s.visitors else 0 end), 0) as visitor_total,
      coalesce(sum(case when s.review_status = 'approved' and s.tyfcb_status = 'approved' and s.status = 'active' then s.tyfcb else 0 end), 0) as tyfcb_total
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
      and weak.tyfcb_total = 0
      and (helper.visitor_total > 0 or helper.referral_total >= 3)
  )
  select p_buddy_team_id, 'rescue_teammate', 5, award_week_id, 'rescue-' || (award_week_id - 2) || '-' || (award_week_id - 1) || '-' || award_week_id, 'One buddy had no Referral, Visitor, and TYFCB for two submitted weeks while the other brought Visitor or 3 Referrals.'
  from rescue_windows
  on conflict (buddy_team_id, bonus_type, period_key)
  do update set
    points = excluded.points,
    week_id = excluded.week_id,
    reason = excluded.reason,
    updated_at = now();
end;
$$;

drop function if exists tianyi.team_leaderboard();

create function tianyi.team_leaderboard()
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
  team_bonus_awards jsonb,
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
      coalesce(sum(points), 0)::bigint as team_bonus_points,
      coalesce(jsonb_agg(to_jsonb(tba) order by tba.period_key, tba.bonus_type), '[]'::jsonb) as team_bonus_awards
    from tianyi.team_bonus_awards tba
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
    coalesce(bs.team_bonus_awards, '[]'::jsonb) as team_bonus_awards,
    dense_rank() over (order by (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0)) desc)
  from tianyi.buddy_teams bt
  left join tianyi.members m on m.buddy_team_id = bt.id and m.is_active = true
  left join member_scores ms on ms.team_id = bt.id
  left join bonus_scores bs on bs.team_id = bt.id
  where bt.is_active = true
  group by bt.id, bt.team_no, bt.name, ms.member_score, bs.team_bonus_points, bs.team_bonus_awards, ms.total_tyfcb, ms.submission_count
  order by (coalesce(ms.member_score, 0) + coalesce(bs.team_bonus_points, 0)) desc, bt.team_no asc
$$;

grant execute on function tianyi.team_leaderboard() to anon, authenticated;

select tianyi.recalculate_all_team_bonus_awards();
