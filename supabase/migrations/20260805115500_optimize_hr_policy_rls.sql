create or replace function private.is_permanent_hr_settings_editor()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select
    not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and private.is_staff_attendance_editor();
$$;

revoke all on function private.is_permanent_hr_settings_editor() from public, anon;
grant execute on function private.is_permanent_hr_settings_editor() to authenticated;

drop policy if exists "staff hr policy read" on public.staff_hr_policy_versions;
create policy "staff hr policy read"
on public.staff_hr_policy_versions for select to authenticated
using ((select private.is_permanent_hr_settings_editor()));
