drop policy if exists "staff hr policy read" on public.staff_hr_policy_versions;
create policy "staff hr policy read"
on public.staff_hr_policy_versions for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);

drop function if exists private.is_permanent_hr_settings_editor();
