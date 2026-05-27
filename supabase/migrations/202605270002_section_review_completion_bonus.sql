alter table tianyi.submissions
add column if not exists monthly_completion_bonus_points integer not null default 0;

create or replace function tianyi.set_submission_score()
returns trigger
language plpgsql
set search_path = tianyi
as $$
declare
  approved_one_to_one integer;
  approved_training integer;
  approved_referrals integer;
  approved_tyfcb numeric;
  approved_visitors integer;
  approved_visitor_joined integer;
  target_month text;
  already_claimed_monthly_bonus boolean;
  five_sections_complete boolean;
begin
  new.admin_bonus_points := greatest(coalesce(new.admin_bonus_points, 0), 0);
  new.attended := false;
  new.full_attendance_bonus := false;

  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
    new.monthly_completion_bonus_points := 0;
    new.score := 0;
    new.updated_at := now();
    return new;
  end if;

  approved_one_to_one := case when new.one_to_one_status = 'approved' then new.one_to_one else 0 end;
  approved_training := case when new.training_status = 'approved' then new.training else 0 end;
  approved_referrals := case when new.referral_status = 'approved' then new.referrals else 0 end;
  approved_tyfcb := case when new.tyfcb_status = 'approved' then new.tyfcb else 0 end;
  approved_visitors := case when new.visitor_status = 'approved' then new.visitors else 0 end;
  approved_visitor_joined := case when new.visitor_status = 'approved' then new.visitor_joined else 0 end;

  select w.month into target_month
  from tianyi.weeks w
  where w.id = new.week_id;

  select exists (
    select 1
    from tianyi.submissions s
    join tianyi.weeks w on w.id = s.week_id
    where s.member_id = new.member_id
      and s.id <> new.id
      and s.status = 'active'
      and w.month = target_month
      and coalesce(s.monthly_completion_bonus_points, 0) > 0
  ) into already_claimed_monthly_bonus;

  five_sections_complete :=
    new.one_to_one > 0 and new.one_to_one_status = 'approved'
    and new.training > 0 and new.training_status = 'approved'
    and new.referrals > 0 and new.referral_status = 'approved'
    and new.tyfcb > 0 and new.tyfcb_status = 'approved'
    and new.visitors > 0 and new.visitor_status = 'approved';

  new.monthly_completion_bonus_points := case
    when five_sections_complete and not already_claimed_monthly_bonus then 3
    else 0
  end;

  new.score :=
    tianyi.score(approved_one_to_one, approved_training, approved_referrals, approved_tyfcb, approved_visitors, approved_visitor_joined, false)
    + new.admin_bonus_points
    + new.monthly_completion_bonus_points;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function tianyi.admin_submissions(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then coalesce(jsonb_agg(
    to_jsonb(sd) || jsonb_build_object(
      'evidence', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from tianyi.evidence e where e.submission_id = sd.id), '[]'::jsonb)
    )
    order by sd.submitted_at desc
  ), '[]'::jsonb) else null end
  from tianyi.submission_details sd
$$;

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
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;
  if p_field not in ('one_to_one_status', 'training_status', 'referral_status', 'tyfcb_status', 'visitor_status') then
    raise exception 'Invalid submission field.';
  end if;
  if p_value not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid submission status.';
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

revoke execute on function tianyi.admin_submissions(text) from public;
grant execute on function tianyi.admin_submissions(text) to anon, authenticated;
revoke execute on function tianyi.admin_review_submission_section(text, uuid, text, text, text) from public;
grant execute on function tianyi.admin_review_submission_section(text, uuid, text, text, text) to anon, authenticated;
