alter table tianyi.submissions
add column if not exists admin_bonus_points integer not null default 0,
add column if not exists admin_bonus_note text;

create or replace function tianyi.set_submission_score()
returns trigger
language plpgsql
set search_path = tianyi
as $$
declare
  admin_attended boolean;
  approved_one_to_one integer;
  approved_training integer;
  approved_referrals integer;
  approved_tyfcb numeric;
  approved_visitors integer;
  approved_visitor_joined integer;
begin
  new.admin_bonus_points := greatest(coalesce(new.admin_bonus_points, 0), 0);

  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
    new.full_attendance_bonus := false;
    new.score := 0;
    new.updated_at := now();
    return new;
  end if;

  select exists (
    select 1 from tianyi.attendance a
    where a.member_id = new.member_id
      and a.week_id = new.week_id
      and a.attended = true
  ) into admin_attended;

  new.attended := admin_attended;
  approved_one_to_one := case when new.one_to_one_status = 'approved' then new.one_to_one else 0 end;
  approved_training := case when new.training_status = 'approved' then new.training else 0 end;
  approved_referrals := case when new.referral_status = 'approved' then new.referrals else 0 end;
  approved_tyfcb := case when new.tyfcb_status = 'approved' then new.tyfcb else 0 end;
  approved_visitors := case when new.visitor_status = 'approved' then new.visitors else 0 end;
  approved_visitor_joined := case when new.visitor_status = 'approved' then new.visitor_joined else 0 end;

  new.full_attendance_bonus := admin_attended
    and approved_one_to_one > 0
    and approved_training > 0
    and approved_referrals > 0
    and approved_tyfcb > 0
    and approved_visitors > 0;

  new.score :=
    tianyi.score(approved_one_to_one, approved_training, approved_referrals, approved_tyfcb, approved_visitors, approved_visitor_joined, new.full_attendance_bonus)
    + new.admin_bonus_points;
  new.updated_at := now();
  return new;
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
begin
  if not tianyi_private.admin_token_ok(p_token) then raise exception 'Invalid admin session.'; end if;

  update tianyi.submissions
  set admin_bonus_points = greatest(coalesce(p_bonus_points, 0), 0),
      admin_bonus_note = nullif(trim(coalesce(p_bonus_note, '')), '')
  where id = p_submission_id;

  return found;
end;
$$;

revoke execute on function tianyi.admin_update_submission_bonus(text, uuid, integer, text) from public;
grant execute on function tianyi.admin_update_submission_bonus(text, uuid, integer, text) to anon, authenticated;
