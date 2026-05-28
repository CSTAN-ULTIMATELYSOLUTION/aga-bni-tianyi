create or replace function tianyi.add_submission_evidence(
  p_submission_id uuid,
  p_member_id uuid,
  p_email text,
  p_kind text,
  p_file_path text,
  p_file_name text
)
returns uuid
language plpgsql
security definer
set search_path = tianyi
as $$
declare
  evidence_id uuid;
begin
  if p_kind not in ('one_to_one', 'training', 'referral', 'tyfcb', 'visitor') then
    raise exception 'Invalid evidence kind.';
  end if;

  if not exists (
    select 1
    from tianyi.submissions s
    join tianyi.members m on m.id = s.member_id
    where s.id = p_submission_id
      and s.member_id = p_member_id
      and lower(m.email) = lower(trim(p_email))
      and m.is_active = true
      and (
        p_file_path like p_member_id::text || '/' || p_submission_id::text || '/%'
        or p_file_path like p_member_id::text || '/' || s.week_id::text || '/%'
      )
  ) then
    raise exception 'Evidence does not match this member submission.';
  end if;

  insert into tianyi.evidence (submission_id, kind, file_path, file_name)
  values (p_submission_id, p_kind, p_file_path, p_file_name)
  returning id into evidence_id;

  return evidence_id;
end;
$$;

revoke execute on function tianyi.add_submission_evidence(uuid, uuid, text, text, text, text) from public;
grant execute on function tianyi.add_submission_evidence(uuid, uuid, text, text, text, text) to anon, authenticated;
