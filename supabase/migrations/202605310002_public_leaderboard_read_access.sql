grant usage on schema tianyi to anon, authenticated;

grant select (id, team_no, name, is_active)
on tianyi.buddy_teams
to anon, authenticated;

grant select (id, full_name, buddy_team_id, is_active)
on tianyi.members
to anon, authenticated;

grant select (id, member_id, status, review_status, score, tyfcb_status, tyfcb)
on tianyi.submissions
to anon, authenticated;

drop policy if exists "Public can read active buddy teams for leaderboard" on tianyi.buddy_teams;
create policy "Public can read active buddy teams for leaderboard" on tianyi.buddy_teams
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read active members for leaderboard" on tianyi.members;
create policy "Public can read active members for leaderboard" on tianyi.members
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read final approved submissions for leaderboard" on tianyi.submissions;
create policy "Public can read final approved submissions for leaderboard" on tianyi.submissions
for select
to anon, authenticated
using (status = 'active' and review_status = 'approved');
