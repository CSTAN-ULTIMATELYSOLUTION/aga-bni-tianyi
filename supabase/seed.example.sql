insert into public.tianyi_admin_users (email)
values ('your-admin-email@example.com')
on conflict (email) do nothing;

insert into public.tianyi_buddy_teams (team_no, name)
select n, 'Buddy Team ' || n
from generate_series(1, 41) n
on conflict (team_no) do nothing;

-- Replace with real members.
-- insert into public.tianyi_members (full_name, email, company, buddy_team_id)
-- select 'Member Name', 'member@example.com', 'Company', id
-- from public.tianyi_buddy_teams
-- where team_no = 1;
