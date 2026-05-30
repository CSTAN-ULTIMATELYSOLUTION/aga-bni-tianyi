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
      'team_bonus_awards', coalesce((select jsonb_agg(to_jsonb(tba) order by tba.week_id, tba.bonus_type) from tianyi.team_bonus_awards tba where tba.buddy_team_id = sd.buddy_team_id), '[]'::jsonb),
      'action_logs', coalesce((
        select jsonb_agg(to_jsonb(log_row) order by log_row.created_at desc)
        from (
          select
            l.id,
            l.actor_type,
            l.actor_email,
            l.action,
            l.entity_type,
            l.entity_id,
            l.member_id,
            l.submission_id,
            l.week_id,
            l.details,
            l.created_at,
            m.full_name as member_name,
            m.email as member_email,
            w.label as week_label
          from tianyi.action_logs l
          left join tianyi.members m on m.id = l.member_id
          left join tianyi.weeks w on w.id = l.week_id
          where l.submission_id = sd.id
          order by l.created_at desc
          limit 50
        ) log_row
      ), '[]'::jsonb)
    )
    order by sd.submitted_at desc
  ), '[]'::jsonb) else null end
  from tianyi.submission_details sd
$$;

revoke execute on function tianyi.admin_submissions(text) from public;
grant execute on function tianyi.admin_submissions(text) to anon, authenticated;
