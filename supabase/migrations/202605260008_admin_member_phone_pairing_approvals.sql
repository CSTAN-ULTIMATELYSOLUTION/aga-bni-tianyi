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
declare new_id uuid;
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;
  insert into tianyi.members (full_name, email, company, phone)
  values (
    trim(p_full_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_company, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  returning id into new_id;
  return new_id;
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
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;

  if p_buddy_member_id is null then
    update tianyi.members
    set buddy_member_id = null, buddy_team_id = null, updated_at = now()
    where id = p_member_id;
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

  return true;
end;
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
  if p_value not in ('pending', 'approved', 'rejected', 'archived') then
    raise exception 'Invalid submission status.';
  end if;
  execute format('update tianyi.submissions set %I = $1::tianyi.tianyi_verification_status where id = $2', p_field)
    using p_value, p_submission_id;
  return true;
end;
$$;

grant execute on function tianyi.admin_add_member(text, text, text, text, text) to anon, authenticated;
