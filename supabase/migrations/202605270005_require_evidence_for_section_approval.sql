create or replace function tianyi.admin_review_submission_section(
  p_token text,
  p_submission_id uuid,
  p_field text,
  p_value text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
  clean_reason text;
  evidence_kind text;
  submitted_value numeric;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;
  if p_field not in ('one_to_one_status', 'training_status', 'referral_status', 'tyfcb_status', 'visitor_status') then
    raise exception 'Invalid submission field.';
  end if;
  if p_value not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid submission status.';
  end if;

  select * into submission_row
  from tianyi.submissions
  where id = p_submission_id;

  if submission_row.id is null then
    return false;
  end if;

  evidence_kind := case p_field
    when 'one_to_one_status' then 'one_to_one'
    when 'training_status' then 'training'
    when 'referral_status' then 'referral'
    when 'tyfcb_status' then 'tyfcb'
    when 'visitor_status' then 'visitor'
  end;

  submitted_value := case p_field
    when 'one_to_one_status' then submission_row.one_to_one
    when 'training_status' then submission_row.training
    when 'referral_status' then submission_row.referrals
    when 'tyfcb_status' then submission_row.tyfcb
    when 'visitor_status' then submission_row.visitors
    else 0
  end;

  if p_value = 'approved'
    and submitted_value > 0
    and not exists (
      select 1
      from tianyi.evidence e
      where e.submission_id = p_submission_id
        and e.kind = evidence_kind
    )
  then
    raise exception 'Cannot approve without proof image.';
  end if;

  clean_reason := nullif(trim(coalesce(p_reason, '')), '');

  execute format(
    'update tianyi.submissions set %I = $1::tianyi.tianyi_verification_status, admin_note = case when $1 = ''rejected'' and $3 is not null then concat_ws(E''\n'', nullif(admin_note, ''''), $3) else admin_note end where id = $2 returning *',
    p_field
  )
    into submission_row
    using p_value, p_submission_id, clean_reason;

  if submission_row.id is not null then
    perform tianyi_private.log_action(
      'admin',
      actor_email,
      case when p_value = 'approved' then 'admin_approve' when p_value = 'rejected' then 'admin_reject_status' else 'admin_set_pending' end,
      'submission',
      p_submission_id,
      submission_row.member_id,
      p_submission_id,
      submission_row.week_id,
      jsonb_build_object('field', p_field, 'status', p_value, 'reason', clean_reason)
    );
  end if;

  return submission_row.id is not null;
end;
$$;

revoke execute on function tianyi.admin_review_submission_section(text, uuid, text, text, text) from public;
grant execute on function tianyi.admin_review_submission_section(text, uuid, text, text, text) to anon, authenticated;
