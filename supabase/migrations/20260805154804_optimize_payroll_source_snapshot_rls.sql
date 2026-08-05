-- Keep reads and mutations separate so SELECT evaluates a single permissive
-- policy, and materialize auth.jwt() once per statement for the RLS planner.
drop policy if exists "staff payroll source snapshots read" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots manage" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots insert" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots update" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots delete" on public.staff_payroll_source_snapshots;

create policy "staff payroll source snapshots read"
on public.staff_payroll_source_snapshots
for select to authenticated
using (
  not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and (select private.can_read_staff_attendance_settings())
);

create policy "staff payroll source snapshots insert"
on public.staff_payroll_source_snapshots
for insert to authenticated
with check (
  not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);

create policy "staff payroll source snapshots update"
on public.staff_payroll_source_snapshots
for update to authenticated
using (
  not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
)
with check (
  not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);

create policy "staff payroll source snapshots delete"
on public.staff_payroll_source_snapshots
for delete to authenticated
using (
  not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);
