create table if not exists tianyi.action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('member', 'admin', 'system')),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  member_id uuid references tianyi.members(id) on delete set null,
  submission_id uuid references tianyi.submissions(id) on delete set null,
  week_id integer references tianyi.weeks(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists action_logs_created_at_idx on tianyi.action_logs(created_at desc);
create index if not exists action_logs_submission_id_idx on tianyi.action_logs(submission_id);
create index if not exists action_logs_member_id_idx on tianyi.action_logs(member_id);

alter table tianyi.action_logs enable row level security;

create or replace function tianyi_private.admin_actor_email(p_token text)
returns text
language sql
security definer
set search_path = tianyi, tianyi_private, extensions
stable
as $$
  select s.email
  from tianyi.admin_sessions s
  join tianyi.admin_users u on u.email = s.email
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now()
    and u.is_active = true
  limit 1
$$;

create or replace function tianyi_private.log_action(
  p_actor_type text,
  p_actor_email text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_member_id uuid default null,
  p_submission_id uuid default null,
  p_week_id integer default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  log_id uuid;
begin
  insert into tianyi.action_logs (
    actor_type,
    actor_email,
    action,
    entity_type,
    entity_id,
    member_id,
    submission_id,
    week_id,
    details
  )
  values (
    p_actor_type,
    lower(nullif(trim(coalesce(p_actor_email, '')), '')),
    p_action,
    p_entity_type,
    p_entity_id,
    p_member_id,
    p_submission_id,
    p_week_id,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function tianyi.admin_action_logs(p_token text, p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc), '[]'::jsonb) else null end
  from (
    select
      l.id,
      l.actor_type,
      l.actor_email,
      l.action,
      l.entity_type,
      l.entity_id,
      l.member_id,
      l.submission_id,
      l.week_id,
      l.details,
      l.created_at,
      m.full_name as member_name,
      m.email as member_email,
      w.label as week_label
    from tianyi.action_logs l
    left join tianyi.members m on m.id = l.member_id
    left join tianyi.weeks w on w.id = l.week_id
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) row_data
$$;

create or replace function tianyi.submit_weekly_update(
  p_member_id uuid,
  p_email text,
  p_week_id integer,
  p_one_to_one integer,
  p_training integer,
  p_referrals integer,
  p_tyfcb numeric,
  p_visitors integer
)
returns table(id uuid, score integer)
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  member_row tianyi.members;
  target_week tianyi.weeks;
  current_week_id integer;
  created_submission tianyi.submissions;
  existing_submission tianyi.submissions;
  log_action text;
begin
  select * into member_row
  from tianyi.members m
  where m.id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
  limit 1;

  if member_row.id is null then
    raise exception 'Member and email do not match.';
  end if;

  select * into target_week
  from tianyi.weeks w
  where w.id = p_week_id;

  if target_week.id is null then
    raise exception 'Selected week is not available.';
  end if;

  select w.id into current_week_id
  from tianyi.weeks w
  where current_date between w.starts_on and w.ends_on
  order by w.id
  limit 1;

  if current_date < date '2026-06-02' then
    if p_week_id <> 1 then
      raise exception 'Only week 1 is open during testing mode.';
    end if;
  elsif current_week_id is null then
    raise exception 'No submission week is currently open.';
  elsif p_week_id not in (current_week_id, greatest(1, current_week_id - 1)) then
    raise exception 'Only current week and last week are open.';
  end if;

  select * into existing_submission
  from tianyi.submissions s
  where s.member_id = p_member_id
    and s.week_id = p_week_id
    and s.status <> 'archived'
  limit 1;

  if existing_submission.id is not null then
    if current_date > target_week.ends_on + 14 then
      raise exception 'This week is locked.';
    end if;

    update tianyi.submissions
    set
      one_to_one = greatest(coalesce(p_one_to_one, 0), 0),
      training = greatest(coalesce(p_training, 0), 0),
      referrals = greatest(coalesce(p_referrals, 0), 0),
      tyfcb = greatest(coalesce(p_tyfcb, 0), 0),
      visitors = greatest(coalesce(p_visitors, 0), 0),
      one_to_one_status = 'pending',
      training_status = 'pending',
      referral_status = 'pending',
      tyfcb_status = 'pending',
      visitor_status = 'pending',
      submitted_at = now(),
      updated_at = now()
    where tianyi.submissions.id = existing_submission.id
    returning * into created_submission;

    log_action := 'member_update_submission';
  else
    insert into tianyi.submissions (
      member_id,
      week_id,
      one_to_one,
      training,
      referrals,
      tyfcb,
      visitors,
      visitor_joined
    )
    values (
      p_member_id,
      p_week_id,
      greatest(coalesce(p_one_to_one, 0), 0),
      greatest(coalesce(p_training, 0), 0),
      greatest(coalesce(p_referrals, 0), 0),
      greatest(coalesce(p_tyfcb, 0), 0),
      greatest(coalesce(p_visitors, 0), 0),
      0
    )
    returning * into created_submission;

    log_action := 'member_submit';
  end if;

  perform tianyi_private.log_action(
    'member',
    member_row.email,
    log_action,
    'submission',
    created_submission.id,
    member_row.id,
    created_submission.id,
    created_submission.week_id,
    jsonb_build_object(
      'one_to_one', created_submission.one_to_one,
      'training', created_submission.training,
      'referrals', created_submission.referrals,
      'tyfcb', created_submission.tyfcb,
      'visitors', created_submission.visitors
    )
  );

  return query select created_submission.id, created_submission.score;
end;
$$;

create or replace function tianyi.admin_add_member(
  p_token text,
  p_full_name text,
  p_email text,
  p_company text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  new_id uuid;
  actor_email text;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  insert into tianyi.members (full_name, email, company, phone)
  values (
    trim(p_full_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_company, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  returning id into new_id;

  perform tianyi_private.log_action('admin', actor_email, 'admin_add_member', 'member', new_id, new_id, null, null, jsonb_build_object('member_name', trim(p_full_name), 'member_email', lower(trim(p_email))));
  return new_id;
end;
$$;

create or replace function tianyi.admin_update_member(
  p_token text,
  p_member_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_company text default null
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  update tianyi.members
  set full_name = trim(p_full_name),
      email = lower(trim(p_email)),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      company = nullif(trim(coalesce(p_company, '')), ''),
      updated_at = now()
  where id = p_member_id
    and is_active = true;

  if found then
    perform tianyi_private.log_action('admin', actor_email, 'admin_update_member', 'member', p_member_id, p_member_id, null, null, jsonb_build_object('member_name', trim(p_full_name), 'member_email', lower(trim(p_email))));
  end if;

  return found;
end;
$$;

create or replace function tianyi.admin_assign_buddy_pair(p_token text, p_member_id uuid, p_buddy_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  target_team tianyi.buddy_teams;
  actor_email text;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  if p_buddy_member_id is null then
    update tianyi.members
    set buddy_member_id = null, buddy_team_id = null, updated_at = now()
    where id = p_member_id;
    perform tianyi_private.log_action('admin', actor_email, 'admin_clear_buddy_pair', 'member', p_member_id, p_member_id, null, null, '{}'::jsonb);
    return true;
  end if;

  if p_member_id = p_buddy_member_id then
    raise exception 'A member cannot be their own buddy.';
  end if;

  select bt.* into target_team
  from tianyi.buddy_teams bt
  where bt.is_active = true
    and (
      exists (select 1 from tianyi.members m where m.id in (p_member_id, p_buddy_member_id) and m.buddy_team_id = bt.id)
      or (select count(*) from tianyi.members m where m.buddy_team_id = bt.id and m.is_active = true) = 0
    )
  order by bt.team_no
  limit 1;

  if target_team.id is null then
    insert into tianyi.buddy_teams (team_no, name)
    values (
      coalesce((select max(team_no) + 1 from tianyi.buddy_teams), 1),
      'Buddy Pair ' || coalesce((select max(team_no) + 1 from tianyi.buddy_teams), 1)
    )
    returning * into target_team;
  end if;

  update tianyi.members
  set buddy_team_id = target_team.id,
      buddy_member_id = case when id = p_member_id then p_buddy_member_id else p_member_id end,
      updated_at = now()
  where id in (p_member_id, p_buddy_member_id);

  update tianyi.members
  set buddy_team_id = null,
      buddy_member_id = null,
      updated_at = now()
  where buddy_team_id = target_team.id
    and id not in (p_member_id, p_buddy_member_id);

  perform tianyi_private.log_action('admin', actor_email, 'admin_assign_buddy_pair', 'member', p_member_id, p_member_id, null, null, jsonb_build_object('buddy_member_id', p_buddy_member_id, 'team_no', target_team.team_no));
  return true;
end;
$$;

create or replace function tianyi.admin_update_submission(p_token text, p_submission_id uuid, p_field text, p_value text)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;
  if p_field not in ('one_to_one_status', 'training_status', 'referral_status', 'tyfcb_status', 'visitor_status') then
    raise exception 'Invalid submission field.';
  end if;
  if p_value not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid submission status.';
  end if;

  execute format('update tianyi.submissions set %I = $1::tianyi.tianyi_verification_status where id = $2 returning *', p_field)
    into submission_row
    using p_value, p_submission_id;

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
      jsonb_build_object('field', p_field, 'status', p_value)
    );
  end if;

  return submission_row.id is not null;
end;
$$;

create or replace function tianyi.admin_update_visitor_joined(p_token text, p_submission_id uuid, p_value integer)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  update tianyi.submissions
  set visitor_joined = greatest(coalesce(p_value, 0), 0)
  where id = p_submission_id
  returning * into submission_row;

  if submission_row.id is not null then
    perform tianyi_private.log_action('admin', actor_email, 'admin_update_visitor_joined', 'submission', p_submission_id, submission_row.member_id, p_submission_id, submission_row.week_id, jsonb_build_object('visitor_joined', greatest(coalesce(p_value, 0), 0)));
  end if;
  return submission_row.id is not null;
end;
$$;

create or replace function tianyi.admin_reject_submission(p_token text, p_submission_id uuid, p_field text, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  perform tianyi.admin_update_submission(p_token, p_submission_id, p_field, 'rejected');
  select * into submission_row from tianyi.submissions where id = p_submission_id;
  perform tianyi.archive_submission(p_submission_id, p_reason);

  perform tianyi_private.log_action('admin', actor_email, 'admin_reject', 'submission', p_submission_id, submission_row.member_id, p_submission_id, submission_row.week_id, jsonb_build_object('field', p_field, 'reason', p_reason));
  return true;
end;
$$;

create or replace function tianyi.admin_update_submission_bonus(
  p_token text,
  p_submission_id uuid,
  p_bonus_points integer,
  p_bonus_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare
  actor_email text;
  submission_row tianyi.submissions;
begin
  actor_email := tianyi_private.admin_actor_email(p_token);
  if actor_email is null then raise exception 'Invalid admin session.'; end if;

  update tianyi.submissions
  set admin_bonus_points = greatest(coalesce(p_bonus_points, 0), 0),
      admin_bonus_note = nullif(trim(coalesce(p_bonus_note, '')), '')
  where id = p_submission_id
  returning * into submission_row;

  if submission_row.id is not null then
    perform tianyi_private.log_action('admin', actor_email, 'admin_bonus_points', 'submission', p_submission_id, submission_row.member_id, p_submission_id, submission_row.week_id, jsonb_build_object('bonus_points', greatest(coalesce(p_bonus_points, 0), 0), 'note', nullif(trim(coalesce(p_bonus_note, '')), '')));
  end if;

  return submission_row.id is not null;
end;
$$;

revoke execute on function tianyi.admin_action_logs(text, integer) from public;
grant execute on function tianyi.admin_action_logs(text, integer) to anon, authenticated;
grant execute on function tianyi.submit_weekly_update(uuid, text, integer, integer, integer, integer, numeric, integer) to anon, authenticated;
grant execute on function tianyi.admin_add_member(text, text, text, text, text) to anon, authenticated;
grant execute on function tianyi.admin_update_member(text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function tianyi.admin_assign_buddy_pair(text, uuid, uuid) to anon, authenticated;
grant execute on function tianyi.admin_update_submission(text, uuid, text, text) to anon, authenticated;
grant execute on function tianyi.admin_update_visitor_joined(text, uuid, integer) to anon, authenticated;
grant execute on function tianyi.admin_reject_submission(text, uuid, text, text) to anon, authenticated;
grant execute on function tianyi.admin_update_submission_bonus(text, uuid, integer, text) to anon, authenticated;
