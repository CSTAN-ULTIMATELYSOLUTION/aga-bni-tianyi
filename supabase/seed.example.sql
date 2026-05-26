insert into tianyi.admin_users (email)
values ('your-admin-email@example.com')
on conflict (email) do nothing;

create temporary table tianyi_seed_buddy_pairs (
  pair_no integer primary key,
  group_name text not null,
  member_a_name text not null,
  member_b_name text not null,
  member_a_email text not null,
  member_b_email text not null
) on commit drop;

insert into tianyi_seed_buddy_pairs
  (pair_no, group_name, member_a_name, member_b_name, member_a_email, member_b_email)
values
  (1, 'CGC', 'Jessy Tee Siow Lee', 'Xindy Chew', 'sample+001a@gmail.com', 'sample+001b@gmail.com'),
  (2, 'CGC', 'Nicholas Yap', 'Nicholas Siew', 'sample+002a@gmail.com', 'sample+002b@gmail.com'),
  (3, 'CGC', 'Dian Chia Wei Hou', 'Aevan Lee', 'sample+003a@gmail.com', 'sample+003b@gmail.com'),
  (4, 'CGC', 'Sherona Yap', 'Benson Tan', 'sample+004a@gmail.com', 'sample+004b@gmail.com'),
  (5, 'CGC', 'Lee Pei Xuan', 'Desmond Yap', 'sample+005a@gmail.com', 'sample+005b@gmail.com'),
  (6, 'CGC', 'Kelly Tan', 'Rocky Lok', 'sample+006a@gmail.com', 'sample+006b@gmail.com'),
  (7, 'CGC', 'Sharon Ang', 'An Tan', 'sample+007a@gmail.com', 'sample+007b@gmail.com'),
  (8, 'CGC', 'Leong Jia Xiao', 'Raymond Chan', 'sample+008a@gmail.com', 'sample+008b@gmail.com'),
  (9, 'CGC', 'Samuel Wan', 'Cecilia Tan', 'sample+009a@gmail.com', 'sample+009b@gmail.com'),
  (10, 'CGC', 'Peter Kuan', 'Sam Lau', 'sample+010a@gmail.com', 'sample+010b@gmail.com'),
  (11, 'CGC', 'Lee Cheng Yang', 'Jimmy Ng', 'sample+011a@gmail.com', 'sample+011b@gmail.com'),
  (12, 'CGC', 'Janice Hee Ying Rui', 'Jaguar Lim', 'sample+012a@gmail.com', 'sample+012b@gmail.com'),
  (13, 'CGC', 'May Pua', 'Simon Ooi', 'sample+013a@gmail.com', 'sample+013b@gmail.com'),
  (14, 'CGC', 'Tan Soon Seng', 'Nancy Lim', 'sample+014a@gmail.com', 'sample+014b@gmail.com'),
  (15, 'CGC', 'Goh Swee Ling', 'Mike Wong', 'sample+015a@gmail.com', 'sample+015b@gmail.com'),
  (16, 'CGC', 'Ng Teck Ming', 'Andy Goh', 'sample+016a@gmail.com', 'sample+016b@gmail.com'),
  (17, 'CGC', 'Christine Cheng', 'Alex Loh', 'sample+017a@gmail.com', 'sample+017b@gmail.com'),
  (18, 'CGC', 'Han Yen Yu', 'Zhang Ai Qing', 'sample+018a@gmail.com', 'sample+018b@gmail.com'),
  (19, 'CMC', 'Alan Wong', 'Damon Lim', 'sample+019a@gmail.com', 'sample+019b@gmail.com'),
  (20, 'CMC', 'Benz Leong', 'Vincent Tay', 'sample+020a@gmail.com', 'sample+020b@gmail.com'),
  (21, 'CMC', 'Denise Lim', 'Miki Choe', 'sample+021a@gmail.com', 'sample+021b@gmail.com'),
  (22, 'CMC', 'John Thi', 'Choong Ruey Liuh', 'sample+022a@gmail.com', 'sample+022b@gmail.com'),
  (23, 'CMC', 'ST Lim', 'Lee Chor Siong', 'sample+023a@gmail.com', 'sample+023b@gmail.com'),
  (24, 'CMC', 'Ben Shee', 'Yong Main Kong', 'sample+024a@gmail.com', 'sample+024b@gmail.com'),
  (25, 'CMC', 'Henry Teoh', 'Frederick Tham', 'sample+025a@gmail.com', 'sample+025b@gmail.com'),
  (26, 'CMC', 'Liew Xuan Ci', 'Krist Wooi', 'sample+026a@gmail.com', 'sample+026b@gmail.com'),
  (27, 'CMC', 'Danny Chin', 'Liz Wang', 'sample+027a@gmail.com', 'sample+027b@gmail.com'),
  (28, 'CMC', 'Cham Fook Whay', 'James Yap', 'sample+028a@gmail.com', 'sample+028b@gmail.com'),
  (29, 'CMC', 'Nicholas Liew', 'Rachel Kong', 'sample+029a@gmail.com', 'sample+029b@gmail.com'),
  (30, 'CMC', 'Rachel Khow', 'Yap Kah Chun', 'sample+030a@gmail.com', 'sample+030b@gmail.com'),
  (31, 'CMC', 'CS Tan', 'Monser Wong', 'sample+031a@gmail.com', 'sample+031b@gmail.com'),
  (32, 'CMC', 'Belle Lee', 'Stephanie Yap', 'sample+032a@gmail.com', 'sample+032b@gmail.com'),
  (33, 'CMC', 'Delvin Tan', 'Lynne Yip', 'sample+033a@gmail.com', 'sample+033b@gmail.com'),
  (34, 'CMC', 'Alan Tee', 'Derek Ng', 'sample+034a@gmail.com', 'sample+034b@gmail.com'),
  (35, 'CMC', 'Ben Cheng', 'Andy Tiew', 'sample+035a@gmail.com', 'sample+035b@gmail.com'),
  (36, 'CMC', 'Nico Goh', 'Alicia Wong', 'sample+036a@gmail.com', 'sample+036b@gmail.com'),
  (37, 'CMC', 'Vincent Lin', 'Tee Chin Huat', 'sample+037a@gmail.com', 'sample+037b@gmail.com'),
  (38, 'CMC', 'Jason Lim Shuo Chen', 'Adam (New)', 'sample+038a@gmail.com', 'sample+038b@gmail.com'),
  (39, 'CMC', 'Moon Lim', 'Raymond Wong', 'sample+039a@gmail.com', 'sample+039b@gmail.com'),
  (40, 'CMC', 'Krision Yap', 'Raynel Choo', 'sample+040a@gmail.com', 'sample+040b@gmail.com');

insert into tianyi.buddy_teams (team_no, name, is_active)
select pair_no, group_name || ' Buddy Pair ' || pair_no, true
from tianyi_seed_buddy_pairs
on conflict (team_no) do update set
  name = excluded.name,
  is_active = true;

insert into tianyi.members (full_name, email, company, phone, buddy_team_id, is_active)
select seed_member.full_name, seed_member.email, null, null, bt.id, true
from tianyi_seed_buddy_pairs p
join tianyi.buddy_teams bt on bt.team_no = p.pair_no
cross join lateral (
  values
    (p.member_a_name, p.member_a_email),
    (p.member_b_name, p.member_b_email)
) as seed_member(full_name, email)
where not exists (
  select 1
  from tianyi.members m
  where lower(trim(m.full_name)) = lower(trim(seed_member.full_name))
)
on conflict (email) do nothing;

update tianyi.members m
set
  buddy_team_id = links.buddy_team_id,
  buddy_member_id = links.buddy_member_id,
  is_active = true,
  updated_at = now()
from (
  select a.member_id, b.member_id as buddy_member_id, bt.id as buddy_team_id
  from tianyi_seed_buddy_pairs p
  join tianyi.buddy_teams bt on bt.team_no = p.pair_no
  join lateral (
    select id as member_id
    from tianyi.members
    where lower(trim(full_name)) = lower(trim(p.member_a_name))
    order by created_at, id
    limit 1
  ) a on true
  join lateral (
    select id as member_id
    from tianyi.members
    where lower(trim(full_name)) = lower(trim(p.member_b_name))
    order by created_at, id
    limit 1
  ) b on true

  union all

  select b.member_id, a.member_id as buddy_member_id, bt.id as buddy_team_id
  from tianyi_seed_buddy_pairs p
  join tianyi.buddy_teams bt on bt.team_no = p.pair_no
  join lateral (
    select id as member_id
    from tianyi.members
    where lower(trim(full_name)) = lower(trim(p.member_a_name))
    order by created_at, id
    limit 1
  ) a on true
  join lateral (
    select id as member_id
    from tianyi.members
    where lower(trim(full_name)) = lower(trim(p.member_b_name))
    order by created_at, id
    limit 1
  ) b on true
) links
where m.id = links.member_id;
