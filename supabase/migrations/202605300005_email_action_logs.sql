create or replace function tianyi.log_email_event(
  p_submission_id uuid,
  p_member_email text,
  p_action text,
  p_recipient text,
  p_status text default 'sent',
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  submission_row tianyi.submissions%rowtype;
  member_row tianyi.members%rowtype;
  allowed_actions text[] := array['email_member_submission', 'email_admin_submission', 'email_member_rejection'];
begin
  select s.* into submission_row
  from tianyi.submissions s
  where s.id = p_submission_id;

  if submission_row.id is null then
    raise exception 'Submission not found.';
  end if;

  select m.* into member_row
  from tianyi.members m
  where m.id = submission_row.member_id
    and lower(m.email) = lower(trim(p_member_email));

  if member_row.id is null then
    raise exception 'Member and submission do not match.';
  end if;

  if not (p_action = any(allowed_actions)) then
    raise exception 'Invalid email log action.';
  end if;

  return tianyi_private.log_action(
    'system',
    'system@tianyi.onesystem',
    p_action,
    'email',
    p_submission_id,
    submission_row.member_id,
    p_submission_id,
    submission_row.week_id,
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object(
      'recipient',
      lower(trim(coalesce(p_recipient, ''))),
      'status',
      coalesce(nullif(trim(p_status), ''), 'sent')
    )
  );
end;
$$;

revoke execute on function tianyi.log_email_event(uuid, text, text, text, text, jsonb) from public;
grant execute on function tianyi.log_email_event(uuid, text, text, text, text, jsonb) to anon, authenticated;
