begin;

create table if not exists public.staff_attendance_settings (
  id text primary key default 'default',
  location text not null default 'VRena',
  standard_daily_minutes integer not null default 480 check (standard_daily_minutes >= 0),
  standard_weekly_minutes integer not null default 2880 check (standard_weekly_minutes >= 0),
  overtime_monthly_cap_minutes integer not null default 2400 check (overtime_monthly_cap_minutes >= 0),
  overtime_yearly_cap_minutes integer not null default 12000 check (overtime_yearly_cap_minutes >= 0),
  night_start time not null default '22:00',
  night_end time not null default '06:00',
  annual_leave_days numeric(5,2) not null default 12 check (annual_leave_days >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_schedule_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.profiles(id) on delete cascade,
  location text not null default 'VRena',
  shift_role text not null default 'Staff',
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'published' check (status in ('draft', 'published', 'completed', 'cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text
);

create table if not exists public.staff_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.staff_schedule_shifts(id) on delete set null,
  work_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'no_show', 'leave', 'holiday')),
  regular_minutes integer not null default 0 check (regular_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  night_minutes integer not null default 0 check (night_minutes >= 0),
  holiday_minutes integer not null default 0 check (holiday_minutes >= 0),
  manager_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text
);

create table if not exists public.staff_leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null default 'annual' check (leave_type in ('annual', 'sick', 'unpaid', 'personal', 'public_holiday')),
  start_date date not null,
  end_date date not null,
  hours numeric(6,2) not null default 8 check (hours >= 0),
  reason text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text,
  constraint staff_leave_requests_date_order check (end_date >= start_date)
);

create index if not exists staff_schedule_shifts_week_idx
  on public.staff_schedule_shifts (shift_date, start_time)
  where deleted_at is null;

create index if not exists staff_schedule_shifts_staff_idx
  on public.staff_schedule_shifts (staff_profile_id, shift_date)
  where deleted_at is null;

create index if not exists staff_attendance_logs_week_idx
  on public.staff_attendance_logs (work_date, clock_in_at)
  where deleted_at is null;

create index if not exists staff_attendance_logs_staff_idx
  on public.staff_attendance_logs (staff_profile_id, work_date)
  where deleted_at is null;

create index if not exists staff_leave_requests_range_idx
  on public.staff_leave_requests (start_date, end_date)
  where deleted_at is null;

create index if not exists staff_leave_requests_staff_idx
  on public.staff_leave_requests (staff_profile_id, start_date)
  where deleted_at is null;

create or replace function public.staff_attendance_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_attendance_settings_touch_updated_at on public.staff_attendance_settings;
create trigger staff_attendance_settings_touch_updated_at
before update on public.staff_attendance_settings
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_schedule_shifts_touch_updated_at on public.staff_schedule_shifts;
create trigger staff_schedule_shifts_touch_updated_at
before update on public.staff_schedule_shifts
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_attendance_logs_touch_updated_at on public.staff_attendance_logs;
create trigger staff_attendance_logs_touch_updated_at
before update on public.staff_attendance_logs
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_leave_requests_touch_updated_at on public.staff_leave_requests;
create trigger staff_leave_requests_touch_updated_at
before update on public.staff_leave_requests
for each row execute function public.staff_attendance_touch_updated_at();

alter table public.staff_attendance_settings enable row level security;
alter table public.staff_schedule_shifts enable row level security;
alter table public.staff_attendance_logs enable row level security;
alter table public.staff_leave_requests enable row level security;

grant select on public.staff_attendance_settings, public.staff_schedule_shifts, public.staff_attendance_logs, public.staff_leave_requests to authenticated;
grant insert, update on public.staff_attendance_settings, public.staff_schedule_shifts, public.staff_attendance_logs, public.staff_leave_requests to authenticated;
grant all on public.staff_attendance_settings, public.staff_schedule_shifts, public.staff_attendance_logs, public.staff_leave_requests to service_role;

drop policy if exists "staff attendance settings read" on public.staff_attendance_settings;
create policy "staff attendance settings read"
on public.staff_attendance_settings
for select to authenticated
using (public.is_staff_console_user(20));

drop policy if exists "staff attendance settings manage" on public.staff_attendance_settings;
create policy "staff attendance settings manage"
on public.staff_attendance_settings
for all to authenticated
using (public.is_staff_console_user(80))
with check (public.is_staff_console_user(80));

drop policy if exists "staff shifts read" on public.staff_schedule_shifts;
create policy "staff shifts read"
on public.staff_schedule_shifts
for select to authenticated
using (public.is_staff_console_user(20));

drop policy if exists "staff shifts manage" on public.staff_schedule_shifts;
create policy "staff shifts manage"
on public.staff_schedule_shifts
for all to authenticated
using (public.is_staff_console_user(80))
with check (public.is_staff_console_user(80));

drop policy if exists "staff attendance logs read" on public.staff_attendance_logs;
create policy "staff attendance logs read"
on public.staff_attendance_logs
for select to authenticated
using (public.is_staff_console_user(20));

drop policy if exists "staff attendance logs manage" on public.staff_attendance_logs;
create policy "staff attendance logs manage"
on public.staff_attendance_logs
for all to authenticated
using (public.is_staff_console_user(50))
with check (public.is_staff_console_user(50));

drop policy if exists "staff leave read" on public.staff_leave_requests;
create policy "staff leave read"
on public.staff_leave_requests
for select to authenticated
using (public.is_staff_console_user(20));

drop policy if exists "staff leave manage" on public.staff_leave_requests;
create policy "staff leave manage"
on public.staff_leave_requests
for all to authenticated
using (public.is_staff_console_user(50))
with check (public.is_staff_console_user(50));

insert into public.staff_attendance_settings (id)
values ('default')
on conflict (id) do nothing;

commit;
