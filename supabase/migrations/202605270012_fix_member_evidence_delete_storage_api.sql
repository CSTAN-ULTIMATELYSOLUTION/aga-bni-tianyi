drop policy if exists "Tianyi checked members delete evidence files" on storage.objects;

create policy "Tianyi checked members delete evidence files" on storage.objects
for delete to anon, authenticated
using (
  bucket_id = 'tianyi-onesystem-evidence'
  and exists (
    select 1
    from tianyi.evidence e
    join tianyi.submissions s on s.id = e.submission_id
    join tianyi.members m on m.id = s.member_id
    where e.file_path = storage.objects.name
      and (storage.foldername(storage.objects.name))[1] = s.member_id::text
      and s.status <> 'archived'
      and m.is_active = true
  )
);

create or replace function tianyi.delete_submission_evidence(
  p_evidence_id uuid,
  p_member_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = tianyi
as $$
declare
  evidence_row tianyi.evidence;
  section_field text;
begin
  select e.* into evidence_row
  from tianyi.evidence e
  join tianyi.submissions s on s.id = e.submission_id
  join tianyi.members m on m.id = s.member_id
  where e.id = p_evidence_id
    and s.member_id = p_member_id
    and lower(m.email) = lower(trim(p_email))
    and m.is_active = true
    and s.status <> 'archived'
  limit 1;

  if evidence_row.id is null then
    raise exception 'Proof image not found for this member submission.';
  end if;

  delete from tianyi.evidence
  where id = evidence_row.id;

  section_field := case evidence_row.kind
    when 'one_to_one' then 'one_to_one_status'
    when 'training' then 'training_status'
    when 'referral' then 'referral_status'
    when 'tyfcb' then 'tyfcb_status'
    when 'visitor' then 'visitor_status'
    else null
  end;

  if section_field is not null then
    execute format(
      'update tianyi.submissions set %I = ''pending'', updated_at = now() where id = $1',
      section_field
    )
    using evidence_row.submission_id;
  end if;
end;
$$;

revoke execute on function tianyi.delete_submission_evidence(uuid, uuid, text) from public;
grant execute on function tianyi.delete_submission_evidence(uuid, uuid, text) to anon, authenticated;
