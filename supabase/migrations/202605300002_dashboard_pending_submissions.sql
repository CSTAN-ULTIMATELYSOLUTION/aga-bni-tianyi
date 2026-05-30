create or replace function tianyi.admin_dashboard(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then jsonb_build_object(
    'stats', jsonb_build_object(
      'members', (select count(*) from tianyi.members where is_active = true),
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
      'tyfcb', (select coalesce(sum(tyfcb), 0) from tianyi.submissions where status = 'active')
    ),
    'leaderboard', coalesce((select jsonb_agg(to_jsonb(t)) from tianyi.team_leaderboard() t), '[]'::jsonb)
  ) else null end
$$;

grant execute on function tianyi.admin_dashboard(text) to anon, authenticated;
