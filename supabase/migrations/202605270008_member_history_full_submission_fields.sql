drop function if exists tianyi.member_submission_history(uuid, text);

create or replace function tianyi.member_submission_history(p_member_id uuid, p_email text)
returns table(
  id uuid,
  member_id uuid,
  week_id integer,
  week_label text,
  starts_on date,
  ends_on date,
  one_to_one integer,
  training integer,
  referrals integer,
  tyfcb numeric,
  visitors integer,
  visitor_joined integer,
  attended boolean,
  full_attendance_bonus boolean,
  score integer,
  one_to_one_status text,
  training_status text,
  referral_status text,
  tyfcb_status text,
  visitor_status text,
  status text,
  admin_note text,
  archived_at timestamptz,
  archived_reason text,
  submitted_at timestamptz,
  updated_at timestamptz,
  full_name text,
  email text,
  buddy_team_id uuid,
  team_no integer,
  buddy_team_name text,
  reviewer_owner text
)
language sql
security definer
set search_path = tianyi
stable
as $$
  select
    s.id,
    s.member_id,
    s.week_id,
    w.label,
    w.starts_on,
    w.ends_on,
    s.one_to_one,
    s.training,
    s.referrals,
    s.tyfcb,
    s.visitors,
    s.visitor_joined,
    s.attended,
    s.full_attendance_bonus,
    s.score,
    s.one_to_one_status::text,
    s.training_status::text,
    s.referral_status::text,
    s.tyfcb_status::text,
    s.visitor_status::text,
    s.status::text,
    s.admin_note,
    s.archived_at,
    s.archived_reason,
    s.submitted_at,
    s.updated_at,
    m.full_name,
    m.email,
    bt.id,
    bt.team_no,
    bt.name,
    m.reviewer_owner
  from tianyi.submissions s
  join tianyi.members m on m.id = s.member_id
  join tianyi.weeks w on w.id = s.week_id
  left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
  where m.id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
  order by s.submitted_at desc
$$;

revoke execute on function tianyi.member_submission_history(uuid, text) from public;
grant execute on function tianyi.member_submission_history(uuid, text) to anon, authenticated;
