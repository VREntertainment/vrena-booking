-- The July payroll snapshot policies were created after the attendance helpers
-- moved to the private schema. Point the policies at the executable helpers so
-- an authorized HR reader can load snapshots without blanking unrelated setup.
drop policy if exists "staff payroll source snapshots read" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots read"
on public.staff_payroll_source_snapshots
for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.can_read_staff_attendance_settings())
);

drop policy if exists "staff payroll source snapshots manage" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots manage"
on public.staff_payroll_source_snapshots
for all to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
)
with check (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);
