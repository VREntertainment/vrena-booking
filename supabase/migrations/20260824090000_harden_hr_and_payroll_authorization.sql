begin;

create or replace function private.is_hr_administrator()
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
stable
as $$
  select public.current_staff_role_key() in ('owner', 'admin')
$$;

revoke all on function private.is_hr_administrator() from public, anon;
grant execute on function private.is_hr_administrator() to authenticated, service_role;

-- Attendance users still need a non-confidential employee directory. Return a
-- deliberately narrow projection rather than exposing the HR source table.
create or replace function public.staff_employee_directory()
returns table (
  profile_id uuid,
  employee_code text,
  attendance_number text,
  legal_name text,
  job_title text,
  department text,
  main_work_location text,
  employment_type text,
  contract_status text,
  active boolean,
  kiosk_access_role text,
  kiosk_pin_configured_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, private
stable
as $$
  select employee.profile_id,
         employee.employee_code,
         employee.attendance_number,
         employee.legal_name,
         employee.job_title,
         employee.department,
         employee.main_work_location,
         employee.employment_type,
         employee.contract_status,
         employee.active,
         employee.kiosk_access_role,
         employee.kiosk_pin_configured_at
  from public.staff_employee_profiles as employee
  where employee.deleted_at is null
    and public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
  order by employee.legal_name nulls last, employee.employee_code nulls last
$$;

revoke all on function public.staff_employee_directory() from public, anon;
grant execute on function public.staff_employee_directory() to authenticated, service_role;

drop policy if exists "staff employee profiles read" on public.staff_employee_profiles;
create policy "staff employee profiles read"
on public.staff_employee_profiles
for select to authenticated
using (
  (select private.is_hr_administrator())
  or profile_id = (select public.current_staff_actor_profile_id())
);

drop policy if exists "staff employee profiles manage" on public.staff_employee_profiles;
create policy "staff employee profiles manage"
on public.staff_employee_profiles
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff hr settings read" on public.staff_hr_settings;
create policy "staff hr settings read" on public.staff_hr_settings
for select to authenticated using ((select private.is_hr_administrator()));
drop policy if exists "staff hr settings manage" on public.staff_hr_settings;
create policy "staff hr settings manage" on public.staff_hr_settings
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff hr setup read" on public.staff_hr_setup_options;
create policy "staff hr setup read" on public.staff_hr_setup_options
for select to authenticated using ((select private.is_hr_administrator()));
drop policy if exists "staff hr setup manage" on public.staff_hr_setup_options;
create policy "staff hr setup manage" on public.staff_hr_setup_options
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff hr adjustments read" on public.staff_hr_adjustments;
create policy "staff hr adjustments read" on public.staff_hr_adjustments
for select to authenticated
using ((select private.is_hr_administrator()) or profile_id = (select public.current_staff_actor_profile_id()));
drop policy if exists "staff hr adjustments manage" on public.staff_hr_adjustments;
create policy "staff hr adjustments manage" on public.staff_hr_adjustments
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff payroll runs read" on public.staff_payroll_runs;
create policy "staff payroll runs read" on public.staff_payroll_runs
for select to authenticated using ((select private.is_hr_administrator()));
drop policy if exists "staff payroll runs manage" on public.staff_payroll_runs;
create policy "staff payroll runs manage" on public.staff_payroll_runs
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff payroll items read" on public.staff_payroll_items;
create policy "staff payroll items read" on public.staff_payroll_items
for select to authenticated
using ((select private.is_hr_administrator()) or profile_id = (select public.current_staff_actor_profile_id()));
drop policy if exists "staff payroll items manage" on public.staff_payroll_items;
create policy "staff payroll items manage" on public.staff_payroll_items
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff hr documents read" on public.staff_hr_documents;
create policy "staff hr documents read" on public.staff_hr_documents
for select to authenticated
using ((select private.is_hr_administrator()) or profile_id = (select public.current_staff_actor_profile_id()));
drop policy if exists "staff hr documents manage" on public.staff_hr_documents;
create policy "staff hr documents manage" on public.staff_hr_documents
for all to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));

drop policy if exists "staff payroll source snapshots read" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots manage" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots insert" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots update" on public.staff_payroll_source_snapshots;
drop policy if exists "staff payroll source snapshots delete" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots read" on public.staff_payroll_source_snapshots
for select to authenticated using (
  not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and (select private.is_hr_administrator())
);
create policy "staff payroll source snapshots insert" on public.staff_payroll_source_snapshots
for insert to authenticated with check ((select private.is_hr_administrator()));
create policy "staff payroll source snapshots update" on public.staff_payroll_source_snapshots
for update to authenticated
using ((select private.is_hr_administrator()))
with check ((select private.is_hr_administrator()));
create policy "staff payroll source snapshots delete" on public.staff_payroll_source_snapshots
for delete to authenticated using ((select private.is_hr_administrator()));

create or replace function private.can_read_staff_hr_document_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
stable
as $$
  select case
    when split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
      and position('..' in coalesce(p_object_name, '')) = 0
    then private.is_hr_administrator()
      or split_part(p_object_name, '/', 1)::uuid = public.current_staff_actor_profile_id()
    else false
  end
$$;

create or replace function private.can_manage_staff_hr_document_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
stable
as $$
  select private.is_hr_administrator()
    and split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
    and position('..' in coalesce(p_object_name, '')) = 0
$$;

notify pgrst, 'reload schema';

commit;
