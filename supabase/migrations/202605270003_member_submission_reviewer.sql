alter table tianyi.members
add column if not exists reviewer_owner text
check (reviewer_owner is null or reviewer_owner in ('PeiXuan', 'Krision', 'Alice'));

create or replace view tianyi.submission_details
with (security_invoker = true)
as
select
  s.id,
  s.member_id,
  s.week_id,
  s.one_to_one,
  s.training,
  s.referrals,
  s.tyfcb,
  s.visitors,
  s.visitor_joined,
  s.attended,
  s.full_attendance_bonus,
  s.score,
  s.one_to_one_status,
  s.training_status,
  s.referral_status,
  s.tyfcb_status,
  s.visitor_status,
  s.status,
  s.admin_note,
  s.archived_at,
  s.archived_reason,
  s.submitted_at,
  s.updated_at,
  w.label as week_label,
  w.starts_on,
  w.ends_on,
  m.full_name,
  m.email,
  bt.id as buddy_team_id,
  bt.team_no,
  bt.name as buddy_team_name,
  m.reviewer_owner
from tianyi.submissions s
join tianyi.weeks w on w.id = s.week_id
join tianyi.members m on m.id = s.member_id
left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id;

drop function if exists tianyi.admin_add_member(text, text, text, text, text);
create or replace function tianyi.admin_add_member(
  p_token text,
  p_full_name text,
  p_email text,
  p_company text,
  p_phone text default null,
  p_reviewer_owner text default null
)
returns uuid
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  new_id uuid;
  actor_email text;
  clean_reviewer text;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  clean_reviewer := nullif(trim(coalesce(p_reviewer_owner, '')), '');
  if clean_reviewer is not null and clean_reviewer not in ('PeiXuan', 'Krision', 'Alice') then
    raise exception 'Invalid submission reviewer.';
  end if;

  insert into tianyi.members (full_name, email, company, phone, reviewer_owner)
  values (
    trim(p_full_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_company, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    clean_reviewer
  )
  returning id into new_id;

  perform tianyi_private.log_action('admin', actor_email, 'admin_add_member', 'member', new_id, new_id, null, null, jsonb_build_object('member_name', trim(p_full_name), 'member_email', lower(trim(p_email)), 'reviewer_owner', clean_reviewer));
  return new_id;
end;
$$;

drop function if exists tianyi.admin_update_member(text, uuid, text, text, text, text);
create or replace function tianyi.admin_update_member(
  p_token text,
  p_member_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_company text default null,
  p_reviewer_owner text default null
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  clean_reviewer text;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  clean_reviewer := nullif(trim(coalesce(p_reviewer_owner, '')), '');
  if clean_reviewer is not null and clean_reviewer not in ('PeiXuan', 'Krision', 'Alice') then
    raise exception 'Invalid submission reviewer.';
  end if;

  update tianyi.members
  set full_name = trim(p_full_name),
      email = lower(trim(p_email)),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      company = nullif(trim(coalesce(p_company, '')), ''),
      reviewer_owner = clean_reviewer,
      updated_at = now()
  where id = p_member_id
    and is_active = true;

  if found then
    perform tianyi_private.log_action('admin', actor_email, 'admin_update_member', 'member', p_member_id, p_member_id, null, null, jsonb_build_object('member_name', trim(p_full_name), 'member_email', lower(trim(p_email)), 'reviewer_owner', clean_reviewer));
  end if;

  return found;
end;
$$;

grant execute on function tianyi.admin_add_member(text, text, text, text, text, text) to anon, authenticated;
grant execute on function tianyi.admin_update_member(text, uuid, text, text, text, text, text) to anon, authenticated;
