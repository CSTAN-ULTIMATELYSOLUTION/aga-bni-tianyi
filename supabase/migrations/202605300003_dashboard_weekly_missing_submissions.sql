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
      'tyfcb', (select coalesce(sum(tyfcb), 0) from tianyi.submissions where status = 'active')
    ),
    'leaderboard', coalesce((select jsonb_agg(to_jsonb(t)) from tianyi.team_leaderboard() t), '[]'::jsonb)
  ) else null end
$$;

grant execute on function tianyi.admin_dashboard(text) to anon, authenticated;
