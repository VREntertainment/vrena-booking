drop policy if exists "staff hr policy read" on public.staff_hr_policy_versions;
create policy "staff hr policy read"
on public.staff_hr_policy_versions for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);

drop policy if exists "staff hr policy manage" on public.staff_hr_policy_versions;
create policy "staff hr policy manage"
on public.staff_hr_policy_versions for all to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
)
with check (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);

alter function public.staff_upsert_hr_setup_option(text, text) security invoker;
alter function public.staff_set_hr_setup_option_active(uuid, boolean) security invoker;
