create extension if not exists pgcrypto with schema extensions;

alter table tianyi.admin_users
  add column if not exists password_hash text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_login_at timestamptz;

create table if not exists tianyi.admin_sessions (
  token_hash text primary key,
  email text not null references tianyi.admin_users(email) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table tianyi.admin_sessions enable row level security;

create or replace function tianyi_private.admin_token_ok(p_token text)
returns boolean
language sql
security definer
set search_path = tianyi, tianyi_private, extensions
stable
as $$
  select exists (
    select 1
    from tianyi.admin_sessions s
    join tianyi.admin_users u on u.email = s.email
    where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and s.expires_at > now()
      and u.is_active = true
  )
$$;

create or replace function tianyi.admin_login(p_email text, p_password text)
returns table(token text, email text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = tianyi, extensions
as $$
declare
  admin_row tianyi.admin_users;
  raw_token text;
begin
  select * into admin_row
  from tianyi.admin_users
  where admin_users.email = lower(trim(p_email))
    and is_active = true
  limit 1;

  if admin_row.email is null or admin_row.password_hash is null or admin_row.password_hash <> crypt(p_password, admin_row.password_hash) then
    raise exception 'Invalid admin email or password.';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into tianyi.admin_sessions (token_hash, email, expires_at)
  values (encode(digest(raw_token, 'sha256'), 'hex'), admin_row.email, now() + interval '12 hours');

  update tianyi.admin_users set last_login_at = now() where admin_users.email = admin_row.email;

  return query select raw_token, admin_row.email, admin_row.role, now() + interval '12 hours';
end;
$$;

create or replace function tianyi.admin_check_session(p_token text)
returns table(email text, role text, expires_at timestamptz)
language sql
security definer
set search_path = tianyi, extensions
stable
as $$
  select u.email, u.role, s.expires_at
  from tianyi.admin_sessions s
  join tianyi.admin_users u on u.email = s.email
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now()
    and u.is_active = true
  limit 1
$$;

create or replace function tianyi.admin_logout(p_token text)
returns boolean
language sql
security definer
set search_path = tianyi, extensions
as $$
  delete from tianyi.admin_sessions
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  select true
$$;

create or replace function tianyi.admin_dashboard(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then jsonb_build_object(
    'stats', jsonb_build_object(
      'members', (select count(*) from tianyi.members where is_active = true),
      'submissions', (select count(*) from tianyi.submissions),
      'tyfcb', (select coalesce(sum(tyfcb), 0) from tianyi.submissions)
    ),
    'leaderboard', coalesce((select jsonb_agg(to_jsonb(t)) from tianyi.team_leaderboard() t), '[]'::jsonb)
  ) else null end
$$;

create or replace function tianyi.admin_members(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.full_name), '[]'::jsonb) else null end
  from (
    select m.*, to_jsonb(b) as buddy, to_jsonb(bt) as buddy_teams
    from tianyi.members m
    left join tianyi.members b on b.id = m.buddy_member_id
    left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
    where m.is_active = true
  ) row_data
$$;

create or replace function tianyi.admin_add_member(p_token text, p_full_name text, p_email text, p_company text)
returns uuid
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
declare new_id uuid;
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  insert into tianyi.members (full_name, email, company)
  values (trim(p_full_name), lower(trim(p_email)), nullif(trim(coalesce(p_company, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function tianyi.admin_deactivate_member(p_token text, p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  update tianyi.members set is_active = false, buddy_member_id = null, buddy_team_id = null where id = p_member_id;
  return true;
end;
$$;

create or replace function tianyi.admin_assign_buddy_pair(p_token text, p_member_id uuid, p_buddy_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  if p_buddy_member_id is null then
    update tianyi.members set buddy_member_id = null, buddy_team_id = null where id = p_member_id;
  else
    perform tianyi.assign_buddy_pair(p_member_id, p_buddy_member_id);
  end if;
  return true;
end;
$$;

create or replace function tianyi.admin_submissions(p_token text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then coalesce(jsonb_agg(to_jsonb(sd) order by sd.submitted_at desc), '[]'::jsonb) else null end
  from tianyi.submission_details sd
$$;

create or replace function tianyi.admin_verification_queue(p_token text, p_kind text)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  with filtered as (
    select sd.*
    from tianyi.submission_details sd
    where sd.status = 'active'
      and case p_kind
        when 'one_to_one' then sd.one_to_one
        when 'training' then sd.training
        when 'referral' then sd.referrals
        when 'tyfcb' then case when sd.tyfcb > 0 then 1 else 0 end
        when 'visitor' then sd.visitors
        else 0
      end > 0
  )
  select case when tianyi_private.admin_token_ok(p_token) then coalesce(jsonb_agg(to_jsonb(f) || jsonb_build_object(
    'evidence', coalesce((select jsonb_agg(to_jsonb(e)) from tianyi.evidence e where e.submission_id = f.id), '[]'::jsonb)
  ) order by f.submitted_at desc), '[]'::jsonb) else null end
  from filtered f
$$;

create or replace function tianyi.admin_update_submission(p_token text, p_submission_id uuid, p_field text, p_value text)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  if p_field not in ('one_to_one_status', 'training_status', 'referral_status', 'tyfcb_status', 'visitor_status') then
    raise exception 'Invalid submission field.';
  end if;
  execute format('update tianyi.submissions set %I = $1 where id = $2', p_field) using p_value, p_submission_id;
  return true;
end;
$$;

create or replace function tianyi.admin_update_visitor_joined(p_token text, p_submission_id uuid, p_value integer)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  update tianyi.submissions set visitor_joined = greatest(coalesce(p_value, 0), 0) where id = p_submission_id;
  return true;
end;
$$;

create or replace function tianyi.admin_reject_submission(p_token text, p_submission_id uuid, p_field text, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  perform tianyi.admin_update_submission(p_token, p_submission_id, p_field, 'rejected');
  perform tianyi.archive_submission(p_submission_id, p_reason);
  return true;
end;
$$;

create or replace function tianyi.admin_attendance_snapshot(p_token text, p_week_id integer)
returns jsonb
language sql
security definer
set search_path = tianyi, tianyi_private
stable
as $$
  select case when tianyi_private.admin_token_ok(p_token) then jsonb_build_object(
    'weeks', coalesce((select jsonb_agg(to_jsonb(w) order by w.id) from tianyi.weeks w), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.full_name) from (select id, full_name, email, company from tianyi.members where is_active = true) m), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(member_id) from tianyi.attendance where week_id = p_week_id and attended = true), '[]'::jsonb)
  ) else null end
$$;

create or replace function tianyi.admin_save_attendance(p_token text, p_week_id integer, p_member_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = tianyi, tianyi_private
as $$
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  delete from tianyi.attendance where week_id = p_week_id;
  insert into tianyi.attendance (week_id, member_id, attended)
  select p_week_id, member_id, true
  from unnest(coalesce(p_member_ids, array[]::uuid[])) member_id;
  return true;
end;
$$;

revoke execute on function tianyi.admin_login(text, text) from public;
grant execute on function tianyi.admin_login(text, text) to anon, authenticated;
grant execute on function tianyi.admin_check_session(text) to anon, authenticated;
grant execute on function tianyi.admin_logout(text) to anon, authenticated;
grant execute on function tianyi.admin_dashboard(text) to anon, authenticated;
grant execute on function tianyi.admin_members(text) to anon, authenticated;
grant execute on function tianyi.admin_add_member(text, text, text, text) to anon, authenticated;
grant execute on function tianyi.admin_deactivate_member(text, uuid) to anon, authenticated;
grant execute on function tianyi.admin_assign_buddy_pair(text, uuid, uuid) to anon, authenticated;
grant execute on function tianyi.admin_submissions(text) to anon, authenticated;
grant execute on function tianyi.admin_verification_queue(text, text) to anon, authenticated;
grant execute on function tianyi.admin_update_submission(text, uuid, text, text) to anon, authenticated;
grant execute on function tianyi.admin_update_visitor_joined(text, uuid, integer) to anon, authenticated;
grant execute on function tianyi.admin_reject_submission(text, uuid, text, text) to anon, authenticated;
grant execute on function tianyi.admin_attendance_snapshot(text, integer) to anon, authenticated;
grant execute on function tianyi.admin_save_attendance(text, integer, uuid[]) to anon, authenticated;
