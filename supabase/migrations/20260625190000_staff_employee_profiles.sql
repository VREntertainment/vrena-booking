begin;

create table if not exists public.staff_employee_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  employee_code text,
  legal_name text,
  personal_phone text,
  personal_email text,
  job_title text,
  employment_type text not null default 'part_time'
    check (employment_type in ('full_time', 'part_time', 'contractor', 'intern', 'probation')),
  start_date date,
  end_date date,
  base_salary_vnd integer not null default 0 check (base_salary_vnd >= 0),
  hourly_rate_vnd integer not null default 0 check (hourly_rate_vnd >= 0),
  bank_name text,
  bank_account_number text,
  tax_code text,
  social_insurance_number text,
  emergency_contact text,
  payroll_note text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text
);

create index if not exists staff_employee_profiles_active_idx
  on public.staff_employee_profiles (active)
  where deleted_at is null;

create index if not exists staff_employee_profiles_employee_code_idx
  on public.staff_employee_profiles (employee_code)
  where deleted_at is null and employee_code is not null;

drop trigger if exists staff_employee_profiles_touch_updated_at on public.staff_employee_profiles;
create trigger staff_employee_profiles_touch_updated_at
before update on public.staff_employee_profiles
for each row execute function public.staff_attendance_touch_updated_at();

alter table public.staff_employee_profiles enable row level security;

grant select, insert, update on public.staff_employee_profiles to authenticated;
grant all on public.staff_employee_profiles to service_role;

drop policy if exists "staff employee profiles read" on public.staff_employee_profiles;
create policy "staff employee profiles read"
on public.staff_employee_profiles
for select to authenticated
using (public.is_staff_console_user(80));

drop policy if exists "staff employee profiles manage" on public.staff_employee_profiles;
create policy "staff employee profiles manage"
on public.staff_employee_profiles
for all to authenticated
using (public.is_staff_console_user(80))
with check (public.is_staff_console_user(80));

insert into public.staff_employee_profiles (
  profile_id,
  legal_name,
  personal_email,
  personal_phone,
  job_title,
  employment_type
)
select
  id,
  nullif(full_name, ''),
  nullif(email, ''),
  nullif(phone, ''),
  initcap(coalesce(nullif(role, ''), 'staff')),
  'part_time'
from public.profiles
where coalesce(is_seed_demo, false) = false
  and coalesce(role, 'player') in ('owner', 'admin', 'manager', 'staff', 'cashier', 'viewer')
  and deleted_at is null
on conflict (profile_id) do nothing;

commit;
