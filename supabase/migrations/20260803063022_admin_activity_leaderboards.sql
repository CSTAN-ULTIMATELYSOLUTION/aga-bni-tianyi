create or replace function tianyi.admin_dashboard(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  with active_member_count as (
    select count(*)::integer as total_members
    from tianyi.members
    where is_active = true
  ),
  weekly_submission_counts as (
    select
      w.id as week_id,
      w.label,
      w.starts_on,
      w.ends_on,
      count(distinct s.member_id)::integer as submitted_members
    from tianyi.weeks w
    left join tianyi.submissions s on s.week_id = w.id and s.status = 'active'
    group by w.id, w.label, w.starts_on, w.ends_on
  ),
  member_activity_totals as (
    select
      m.id as member_id,
      m.full_name,
      m.company,
      bt.team_no,
      coalesce(sum(case when s.one_to_one_status = 'approved' then s.one_to_one else 0 end), 0)::numeric as one_to_one,
      coalesce(sum(case when s.training_status = 'approved' then s.training else 0 end), 0)::numeric as training,
      coalesce(sum(case when s.referral_status = 'approved' then s.referrals else 0 end), 0)::numeric as referral,
      coalesce(sum(case when s.tyfcb_status = 'approved' then s.tyfcb else 0 end), 0)::numeric as tyfcb,
      coalesce(sum(case when s.visitor_status = 'approved' then s.visitors else 0 end), 0)::numeric as visitor
    from tianyi.members m
    left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
    left join tianyi.submissions s on s.member_id = m.id and s.status = 'active'
    where m.is_active = true
    group by m.id, m.full_name, m.company, bt.team_no
  ),
  activity_ranked as (
    select
      activity.category,
      totals.member_id,
      totals.full_name,
      totals.company,
      totals.team_no,
      activity.value,
      dense_rank() over (
        partition by activity.category
        order by activity.value desc
      )::integer as rank
    from member_activity_totals totals
    cross join lateral (
      values
        ('one_to_one'::text, totals.one_to_one),
        ('training'::text, totals.training),
        ('referral'::text, totals.referral),
        ('tyfcb'::text, totals.tyfcb),
        ('visitor'::text, totals.visitor)
    ) as activity(category, value)
    where activity.value > 0
  ),
  activity_leaderboards as (
    select coalesce(jsonb_object_agg(category, leaders), '{}'::jsonb) as data
    from (
      select
        category,
        jsonb_agg(
          jsonb_build_object(
            'member_id', member_id,
            'full_name', full_name,
            'company', company,
            'team_no', team_no,
            'value', value,
            'rank', rank
          )
          order by rank, full_name
        ) as leaders
      from activity_ranked
      where rank <= 5
      group by category
    ) top_five_by_category
  )
  select case when tianyi_private.admin_token_ok(p_token) then jsonb_build_object(
    'stats', jsonb_build_object(
      'members', (select total_members from active_member_count),
      'submissions', (select count(*) from tianyi.submissions where status = 'active'),
      'pending_submissions', (
        select count(*)
        from tianyi.submissions
        where status = 'active'
          and (
            (one_to_one > 0 and one_to_one_status = 'pending')
            or (training > 0 and training_status = 'pending')
            or (referrals > 0 and referral_status = 'pending')
            or (tyfcb > 0 and tyfcb_status = 'pending')
            or (visitors > 0 and visitor_status = 'pending')
          )
      ),
      'weekly_missing_submissions', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'week_id', week_id,
            'label', label,
            'starts_on', starts_on,
            'ends_on', ends_on,
            'submitted_members', submitted_members,
            'missing_members', greatest(0, (select total_members from active_member_count) - submitted_members)
          )
          order by week_id
        )
        from weekly_submission_counts
      ), '[]'::jsonb),
      'tyfcb', (select coalesce(sum(tyfcb), 0) from tianyi.submissions where status = 'active'),
      'activity_leaders', (select data from activity_leaderboards)
    ),
    'leaderboard', coalesce((select jsonb_agg(to_jsonb(t)) from tianyi.team_leaderboard() t), '[]'::jsonb)
  ) else null end
$$;

revoke execute on function tianyi.admin_dashboard(text) from public;
grant execute on function tianyi.admin_dashboard(text) to anon, authenticated;
