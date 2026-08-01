drop policy if exists "staff payroll source snapshots read" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots read"
on public.staff_payroll_source_snapshots
for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select public.can_read_staff_attendance_settings())
);

drop policy if exists "staff payroll source snapshots manage" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots manage"
on public.staff_payroll_source_snapshots
for all to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select public.is_staff_attendance_editor())
)
with check (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select public.is_staff_attendance_editor())
);
