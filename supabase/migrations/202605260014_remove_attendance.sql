do $$
begin
  if to_regclass('tianyi.attendance') is not null then
    drop trigger if exists attendance_refresh_scores on tianyi.attendance;
  end if;
end;
$$;
drop function if exists tianyi.refresh_attendance_scores();
drop function if exists tianyi.admin_attendance_snapshot(text, integer);
drop function if exists tianyi.admin_save_attendance(text, integer, uuid[]);

drop table if exists tianyi.attendance cascade;

create or replace function tianyi.score(
  p_one_to_one integer,
  p_training integer,
  p_referrals integer,
  p_tyfcb numeric,
  p_visitors integer,
  p_visitor_joined integer,
  p_full_attendance boolean
)
returns integer
language sql
immutable
set search_path = tianyi
as $$
  select
    least(coalesce(p_one_to_one, 0), 2)
    + coalesce(p_training, 0) * 5
    + coalesce(p_referrals, 0) * 5
    + case
        when coalesce(p_tyfcb, 0) >= 30000 then 12
        when coalesce(p_tyfcb, 0) >= 20000 then 9
        when coalesce(p_tyfcb, 0) >= 10000 then 6
        when coalesce(p_tyfcb, 0) >= 1000 then 3
        when coalesce(p_tyfcb, 0) >= 100 then 1
        else 0
      end
    + coalesce(p_visitors, 0) * 10
    + coalesce(p_visitor_joined, 0) * 25
$$;

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
begin
  new.admin_bonus_points := greatest(coalesce(new.admin_bonus_points, 0), 0);
  new.attended := false;
  new.full_attendance_bonus := false;

  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
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

  new.score :=
    tianyi.score(approved_one_to_one, approved_training, approved_referrals, approved_tyfcb, approved_visitors, approved_visitor_joined, false)
    + new.admin_bonus_points;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function tianyi.submission_receipt(p_submission_id uuid)
returns table(
  id uuid,
  week_label text,
  status text,
  score integer,
  full_name text,
  team_no integer,
  one_to_one integer,
  training integer,
  referrals integer,
  tyfcb numeric,
  visitors integer,
  attended boolean,
  submitted_at timestamptz
)
language sql
security definer
set search_path = tianyi
stable
as $$
  select
    s.id,
    w.label,
    s.status::text,
    s.score,
    m.full_name,
    bt.team_no,
    s.one_to_one,
    s.training,
    s.referrals,
    s.tyfcb,
    s.visitors,
    false,
    s.submitted_at
  from tianyi.submissions s
  join tianyi.members m on m.id = s.member_id
  join tianyi.weeks w on w.id = s.week_id
  left join tianyi.buddy_teams bt on bt.id = m.buddy_team_id
  where s.id = p_submission_id
  limit 1
$$;

update tianyi.submissions
set attended = false,
    full_attendance_bonus = false,
    updated_at = now();

revoke execute on function tianyi.submission_receipt(uuid) from public;
grant execute on function tianyi.submission_receipt(uuid) to anon, authenticated;
