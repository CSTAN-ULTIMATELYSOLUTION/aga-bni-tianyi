create or replace function tianyi.member_submission_history(p_member_id uuid, p_email text)
returns table(
  id uuid,
  member_id uuid,
  week_id integer,
  week_label text,
  score integer,
  status text,
  submitted_at timestamptz
)
language sql
security definer
set search_path = tianyi
stable
as $$
  select s.id, s.member_id, s.week_id, w.label, s.score, s.status::text, s.submitted_at
  from tianyi.submissions s
  join tianyi.members m on m.id = s.member_id
  join tianyi.weeks w on w.id = s.week_id
  where m.id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
  order by s.submitted_at desc
$$;

revoke execute on function tianyi.member_submission_history(uuid, text) from public;
grant execute on function tianyi.member_submission_history(uuid, text) to anon, authenticated;
