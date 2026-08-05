drop policy if exists "staff hr policy manage" on public.staff_hr_policy_versions;

grant select on public.staff_hr_policy_versions to authenticated;
revoke insert, update, delete on public.staff_hr_policy_versions from authenticated;

create index if not exists staff_hr_policy_versions_created_by_idx
on public.staff_hr_policy_versions(created_by);
