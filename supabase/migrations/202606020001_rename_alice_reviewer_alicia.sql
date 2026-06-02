do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  where c.conrelid = 'tianyi.members'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%reviewer_owner%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table tianyi.members drop constraint %I', constraint_name);
  end if;
end;
$$;

update tianyi.members
set reviewer_owner = 'Alicia'
where reviewer_owner = 'Alice';

alter table tianyi.members
add constraint members_reviewer_owner_check
check (reviewer_owner is null or reviewer_owner in ('PeiXuan', 'Krision', 'Alicia'));

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
  if clean_reviewer is not null and clean_reviewer not in ('PeiXuan', 'Krision', 'Alicia') then
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
  if clean_reviewer is not null and clean_reviewer not in ('PeiXuan', 'Krision', 'Alicia') then
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
