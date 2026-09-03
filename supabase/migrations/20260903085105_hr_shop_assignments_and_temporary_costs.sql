begin;

create extension if not exists btree_gist with schema extensions;

insert into public.staff_hr_setup_options (option_type, name, active, sort_order)
select 'location', 'VRE', true, 30
where not exists (select 1 from public.staff_hr_setup_options where option_type = 'location' and name = 'VRE' and deleted_at is null);

-- User-confirmed organizational corrections; pay and attendance are untouched.
update public.staff_employee_profiles
set main_work_location = 'HaDo', payroll_location = 'HaDo'
where deleted_at is null and (department = 'GC' or employee_code = 'NV27');
update public.staff_employee_profiles
set main_work_location = 'VRE', payroll_location = 'VRE'
where deleted_at is null and department = 'Office';

alter table public.staff_employee_profiles
  add constraint staff_employee_home_department_check check (
    deleted_at is not null or (
      (department is distinct from 'Office' or main_work_location is not distinct from 'VRE')
      and (department is distinct from 'GC' or main_work_location is not distinct from 'HaDo')
    )
  );

create table public.staff_cost_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.staff_employee_profiles(profile_id),
  cost_location text not null check (cost_location in ('HaDo', 'CS', 'VRE')),
  start_date date not null,
  end_date date not null,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by uuid default public.current_staff_actor_profile_id(),
  cancelled_at timestamptz,
  cancelled_by uuid,
  check (end_date >= start_date and end_date - start_date <= 365),
  exclude using gist (profile_id with =, daterange(start_date, end_date, '[]') with &&)
    where (cancelled_at is null)
);

alter table public.staff_cost_assignments enable row level security;
revoke all on public.staff_cost_assignments from public, anon, authenticated;
grant select, insert on public.staff_cost_assignments to authenticated;
grant update (cancelled_at, cancelled_by) on public.staff_cost_assignments to authenticated;
grant all on public.staff_cost_assignments to service_role;

create function private.stamp_staff_cost_assignment()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := public.current_staff_actor_profile_id();
    new.created_at := now();
  else
    new.cancelled_by := public.current_staff_actor_profile_id();
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_staff_cost_assignment() from public, anon, authenticated;
create trigger stamp_staff_cost_assignment before insert or update on public.staff_cost_assignments
for each row execute function private.stamp_staff_cost_assignment();

create policy "HR administrators read cost assignments" on public.staff_cost_assignments
for select to authenticated using ((select private.is_hr_administrator()));
create policy "HR administrators create cost assignments" on public.staff_cost_assignments
for insert to authenticated with check ((select private.is_hr_administrator())
  and created_by = (select public.current_staff_actor_profile_id()) and cancelled_at is null and cancelled_by is null);
create policy "HR administrators cancel cost assignments" on public.staff_cost_assignments
for update to authenticated using ((select private.is_hr_administrator()) and cancelled_at is null)
with check ((select private.is_hr_administrator()) and cancelled_at is not null
  and cancelled_by = (select public.current_staff_actor_profile_id()));

create trigger staff_kiosk_audit_staff_cost_assignments
after insert or update on public.staff_cost_assignments
for each row execute function public.staff_kiosk_audit_mutation();

comment on table public.staff_cost_assignments is 'Dated shop cost attribution. Inclusive dates, no overlapping active assignments. Does not change employment home location or payroll amounts.';
notify pgrst, 'reload schema';
commit;
