drop function if exists tianyi.submission_receipt(uuid);

create or replace function tianyi.submission_receipt(p_submission_id uuid)
returns table(
  id uuid,
  week_label text,
  status text,
  score integer,
  full_name text,
  team_no integer,
  one_to_one integer,
  training integer,
  referrals integer,
  tyfcb numeric,
  visitors integer,
  visitor_joined integer,
  attended boolean,
  one_to_one_status text,
  training_status text,
  referral_status text,
  tyfcb_status text,
  visitor_status text,
  admin_bonus_points integer,
  admin_bonus_note text,
  monthly_completion_bonus_points integer,
  reviewer_owner text,
  approved_by text,
  approvals jsonb,
  submitted_at timestamptz
)
language sql
security definer
set search_path = tianyi
stable
as $$
  select
    s.id,
    w.label,
    s.status::text,
    s.score,
    m.full_name,
    bt.team_no,
    s.one_to_one,
    s.training,
    s.referrals,
    s.tyfcb,
    s.visitors,
    s.visitor_joined,
    false,
    s.one_to_one_status::text,
    s.training_status::text,
    s.referral_status::text,
    s.tyfcb_status::text,
    s.visitor_status::text,
    coalesce(s.admin_bonus_points, 0),
    s.admin_bonus_note,
    coalesce(s.monthly_completion_bonus_points, 0),
    m.reviewer_owner,
    approval_summary.approved_by,
    coalesce(approval_summary.approvals, '[]'::jsonb),
    s.submitted_at
  from tianyi.submissions s
  join tianyi.members m on m.id = s.member_id
  join tianyi.weeks w on w.id = s.week_id
  left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
  left join lateral (
    select
      string_agg(distinct latest.actor_email, ', ' order by latest.actor_email) filter (where latest.actor_email is not null) as approved_by,
      jsonb_agg(
        jsonb_build_object(
          'field', latest.field,
          'admin', latest.actor_email,
          'approved_at', latest.created_at
        )
        order by latest.created_at desc
      ) as approvals
    from (
      select distinct on (l.details->>'field')
        l.details->>'field' as field,
        l.actor_email,
        l.created_at
      from tianyi.action_logs l
      where l.submission_id = s.id
        and l.action = 'admin_approve'
        and l.details->>'field' is not null
      order by l.details->>'field', l.created_at desc
    ) latest
  ) approval_summary on true
  where s.id = p_submission_id
  limit 1
$$;

revoke execute on function tianyi.submission_receipt(uuid) from public;
grant execute on function tianyi.submission_receipt(uuid) to anon, authenticated;
