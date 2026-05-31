alter table tianyi.submissions
alter column review_status set default 'submitted';

alter table tianyi.submissions
drop constraint if exists submissions_review_status_check;

alter table tianyi.submissions
add constraint submissions_review_status_check
check (review_status in ('submitted', 'reviewing', 'approved', 'rejected'));

update tianyi.submissions s
set review_status = 'submitted'
where s.review_status = 'reviewing'
  and (s.one_to_one <= 0 or s.one_to_one_status = 'pending')
  and (s.training <= 0 or s.training_status = 'pending')
  and (s.referrals <= 0 or s.referral_status = 'pending')
  and (s.tyfcb <= 0 or s.tyfcb_status = 'pending')
  and (s.visitors <= 0 or s.visitor_status = 'pending');

create or replace function tianyi.normalize_submission_review_status()
returns trigger
language plpgsql
set search_path = tianyi
as $$
begin
  if new.review_status = 'reviewing'
    and (new.one_to_one <= 0 or new.one_to_one_status = 'pending')
    and (new.training <= 0 or new.training_status = 'pending')
    and (new.referrals <= 0 or new.referral_status = 'pending')
    and (new.tyfcb <= 0 or new.tyfcb_status = 'pending')
    and (new.visitors <= 0 or new.visitor_status = 'pending') then
    new.review_status := 'submitted';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_review_status_before_score on tianyi.submissions;
create trigger normalize_review_status_before_score
before insert or update on tianyi.submissions
for each row execute function tianyi.normalize_submission_review_status();

create or replace function tianyi.admin_finalize_submission_review(
  p_token text,
  p_submission_id uuid,
  p_value text
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
  submitted_count integer;
  pending_count integer;
  rejected_count integer;
  unapproved_count integer;
  team_id uuid;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;
  if p_value not in ('approved', 'rejected') then
    raise exception 'Invalid final review status.';
  end if;

  select * into submission_row
  from tianyi.submissions
  where id = p_submission_id
    and status = 'active';

  if submission_row.id is null then
    return false;
  end if;

  submitted_count :=
    case when submission_row.one_to_one > 0 then 1 else 0 end +
    case when submission_row.training > 0 then 1 else 0 end +
    case when submission_row.referrals > 0 then 1 else 0 end +
    case when submission_row.tyfcb > 0 then 1 else 0 end +
    case when submission_row.visitors > 0 then 1 else 0 end;

  pending_count :=
    case when submission_row.one_to_one > 0 and submission_row.one_to_one_status = 'pending' then 1 else 0 end +
    case when submission_row.training > 0 and submission_row.training_status = 'pending' then 1 else 0 end +
    case when submission_row.referrals > 0 and submission_row.referral_status = 'pending' then 1 else 0 end +
    case when submission_row.tyfcb > 0 and submission_row.tyfcb_status = 'pending' then 1 else 0 end +
    case when submission_row.visitors > 0 and submission_row.visitor_status = 'pending' then 1 else 0 end;

  rejected_count :=
    case when submission_row.one_to_one > 0 and submission_row.one_to_one_status = 'rejected' then 1 else 0 end +
    case when submission_row.training > 0 and submission_row.training_status = 'rejected' then 1 else 0 end +
    case when submission_row.referrals > 0 and submission_row.referral_status = 'rejected' then 1 else 0 end +
    case when submission_row.tyfcb > 0 and submission_row.tyfcb_status = 'rejected' then 1 else 0 end +
    case when submission_row.visitors > 0 and submission_row.visitor_status = 'rejected' then 1 else 0 end;

  unapproved_count :=
    case when submission_row.one_to_one > 0 and submission_row.one_to_one_status <> 'approved' then 1 else 0 end +
    case when submission_row.training > 0 and submission_row.training_status <> 'approved' then 1 else 0 end +
    case when submission_row.referrals > 0 and submission_row.referral_status <> 'approved' then 1 else 0 end +
    case when submission_row.tyfcb > 0 and submission_row.tyfcb_status <> 'approved' then 1 else 0 end +
    case when submission_row.visitors > 0 and submission_row.visitor_status <> 'approved' then 1 else 0 end;

  if p_value = 'approved' and pending_count > 0 then
    raise exception 'Finish all section reviews first.';
  end if;

  if p_value = 'approved' and unapproved_count > 0 then
    raise exception 'Only fully approved submissions can be finalized as approved.';
  end if;

  if p_value = 'rejected' and rejected_count = 0 then
    raise exception 'Rejected final status requires at least one rejected section.';
  end if;

  update tianyi.submissions
  set review_status = p_value,
      updated_at = now()
  where id = p_submission_id
  returning * into submission_row;

  select m.buddy_team_id into team_id
  from tianyi.members m
  where m.id = submission_row.member_id;

  perform tianyi.recalculate_team_bonus_awards(team_id);
  perform tianyi_private.log_action(
    'admin',
    actor_email,
    case when p_value = 'approved' then 'admin_finalize_approved' else 'admin_finalize_rejected' end,
    'submission',
    p_submission_id,
    submission_row.member_id,
    p_submission_id,
    submission_row.week_id,
    jsonb_build_object(
      'review_status', p_value,
      'submitted_sections', submitted_count,
      'pending_sections', pending_count,
      'rejected_sections', rejected_count
    )
  );

  return true;
end;
$$;
