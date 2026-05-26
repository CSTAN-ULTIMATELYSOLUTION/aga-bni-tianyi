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
  attended boolean,
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
    coalesce(a.attended, false),
    s.submitted_at
  from tianyi.submissions s
  join tianyi.members m on m.id = s.member_id
  join tianyi.weeks w on w.id = s.week_id
  left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
  left join tianyi.attendance a on a.member_id = s.member_id and a.week_id = s.week_id
  where s.id = p_submission_id
  limit 1
$$;

revoke execute on function tianyi.submission_receipt(uuid) from public;
grant execute on function tianyi.submission_receipt(uuid) to anon, authenticated;
