begin;

-- Keep the stored role key as "cashier" for compatibility, but treat it as
-- the lower Office Staff access tier. The UI displays "Office Staff".
create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
as $$
  select case
    when lower(coalesce(p_email, '')) = 'emilejacquet@icloud.com' then 120
    when lower(coalesce(p_email, '')) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com') then 100
    when lower(coalesce(p_role, '')) in ('super_admin', 'owner') then 120
    when lower(coalesce(p_role, '')) = 'admin' then 100
    when lower(coalesce(p_role, '')) = 'manager' then 80
    when lower(coalesce(p_role, '')) = 'staff' then 50
    when lower(coalesce(p_role, '')) in ('cashier', 'viewer') then 20
    else 0
  end;
$$;

create or replace function public.current_staff_role_key()
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_jwt_email text := nullif(auth.jwt() ->> 'email', '');
  v_profile_email text;
  v_profile_role text;
  v_rank integer := 0;
begin
  if v_actor is null then
    return 'player';
  end if;

  select email
  into v_auth_email
  from auth.users
  where id = v_actor;

  select email, role
  into v_profile_email, v_profile_role
  from public.profiles
  where id = v_actor
    and deleted_at is null;

  v_rank := greatest(
    public.staff_role_rank(v_profile_role, v_profile_email),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, v_jwt_email)
  );

  if v_rank >= 120 then
    return 'owner';
  elsif v_rank >= 100 then
    return 'admin';
  elsif v_rank >= 80 then
    return 'manager';
  elsif lower(coalesce(v_profile_role, '')) = 'cashier' then
    return 'cashier';
  elsif v_rank >= 50 then
    return 'staff';
  elsif v_rank >= 20 then
    return 'viewer';
  end if;

  return 'player';
end;
$$;

create or replace function public.can_read_staff_attendance_settings()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer');
$$;

create or replace function public.is_staff_attendance_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_key() in ('owner', 'admin', 'cashier');
$$;

create or replace function public.can_read_staff_attendance_row(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
    or p_profile_id = (select auth.uid());
$$;

do $$
begin
  if to_regclass('public.staff_attendance_settings') is not null then
    drop policy if exists "staff attendance settings read" on public.staff_attendance_settings;
    create policy "staff attendance settings read"
    on public.staff_attendance_settings
    for select to authenticated
    using ((select public.can_read_staff_attendance_settings()));

    drop policy if exists "staff attendance settings manage" on public.staff_attendance_settings;
    create policy "staff attendance settings manage"
    on public.staff_attendance_settings
    for all to authenticated
    using ((select public.is_staff_attendance_editor()))
    with check ((select public.is_staff_attendance_editor()));
  end if;

  if to_regclass('public.staff_schedule_shifts') is not null then
    drop policy if exists "staff shifts read" on public.staff_schedule_shifts;
    create policy "staff shifts read"
    on public.staff_schedule_shifts
    for select to authenticated
    using ((select public.can_read_staff_attendance_row(staff_profile_id)));

    drop policy if exists "staff shifts manage" on public.staff_schedule_shifts;
    create policy "staff shifts manage"
    on public.staff_schedule_shifts
    for all to authenticated
    using ((select public.is_staff_attendance_editor()))
    with check ((select public.is_staff_attendance_editor()));
  end if;

  if to_regclass('public.staff_attendance_logs') is not null then
    drop policy if exists "staff attendance logs read" on public.staff_attendance_logs;
    create policy "staff attendance logs read"
    on public.staff_attendance_logs
    for select to authenticated
    using ((select public.can_read_staff_attendance_row(staff_profile_id)));

    drop policy if exists "staff attendance logs manage" on public.staff_attendance_logs;
    create policy "staff attendance logs manage"
    on public.staff_attendance_logs
    for all to authenticated
    using ((select public.is_staff_attendance_editor()))
    with check ((select public.is_staff_attendance_editor()));
  end if;

  if to_regclass('public.staff_leave_requests') is not null then
    drop policy if exists "staff leave read" on public.staff_leave_requests;
    create policy "staff leave read"
    on public.staff_leave_requests
    for select to authenticated
    using ((select public.can_read_staff_attendance_row(staff_profile_id)));

    drop policy if exists "staff leave manage" on public.staff_leave_requests;
    create policy "staff leave manage"
    on public.staff_leave_requests
    for all to authenticated
    using ((select public.is_staff_attendance_editor()))
    with check ((select public.is_staff_attendance_editor()));
  end if;

  if to_regclass('public.staff_employee_profiles') is not null then
    drop policy if exists "staff employee profiles read" on public.staff_employee_profiles;
    create policy "staff employee profiles read"
    on public.staff_employee_profiles
    for select to authenticated
    using ((select public.can_read_staff_attendance_row(profile_id)));

    drop policy if exists "staff employee profiles manage" on public.staff_employee_profiles;
    create policy "staff employee profiles manage"
    on public.staff_employee_profiles
    for all to authenticated
    using ((select public.is_staff_attendance_editor()))
    with check ((select public.is_staff_attendance_editor()));
  end if;
end $$;

revoke all on function public.current_staff_role_key() from public;
revoke all on function public.can_read_staff_attendance_settings() from public;
revoke all on function public.is_staff_attendance_editor() from public;
revoke all on function public.can_read_staff_attendance_row(uuid) from public;

grant execute on function public.current_staff_role_key() to authenticated, service_role;
grant execute on function public.can_read_staff_attendance_settings() to authenticated, service_role;
grant execute on function public.is_staff_attendance_editor() to authenticated, service_role;
grant execute on function public.can_read_staff_attendance_row(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
