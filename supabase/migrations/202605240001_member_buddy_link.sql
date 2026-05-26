alter table public.tianyi_members
add column if not exists buddy_member_id uuid references public.tianyi_members(id) on delete set null;

create index if not exists tianyi_members_buddy_member_id_idx
on public.tianyi_members (buddy_member_id);
