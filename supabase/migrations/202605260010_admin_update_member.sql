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
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;

  update tianyi.members
  set full_name = trim(p_full_name),
      email = lower(trim(p_email)),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      company = nullif(trim(coalesce(p_company, '')), ''),
      updated_at = now()
  where id = p_member_id
    and is_active = true;

  return found;
end;
$$;

revoke execute on function tianyi.admin_update_member(text, uuid, text, text, text, text) from public;
grant execute on function tianyi.admin_update_member(text, uuid, text, text, text, text) to anon, authenticated;
