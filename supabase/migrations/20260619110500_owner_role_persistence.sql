alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or lower(role) in ('super_admin', 'owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player')
  ) not valid;

create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
as $$
  select case
    when lower(coalesce(p_email, '')) = 'emile@vre-vietnam.com' then 120
    when lower(coalesce(p_role, '')) in ('super_admin', 'owner') then 120
    when lower(coalesce(p_email, '')) = 'contact@vre-vietnam.com' then 100
    when lower(coalesce(p_role, '')) = 'admin' then 100
    when lower(coalesce(p_role, '')) = 'manager' then 80
    when lower(coalesce(p_role, '')) in ('staff', 'cashier') then 50
    when lower(coalesce(p_role, '')) = 'viewer' then 20
    else 0
  end;
$$;

create or replace function public.current_staff_role_rank()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(max(public.staff_role_rank(role, email)), 0)
  from public.profiles
  where id = (select auth.uid())
    and deleted_at is null;
$$;

create or replace function public.is_vrena_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= 100;
$$;

create or replace function public.is_vrena_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= 120;
$$;

create or replace function public.set_staff_profile_role(
  p_profile_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
begin
  if v_actor is null or not public.is_vrena_admin() then
    raise exception 'Admin access required.';
  end if;

  if to_regprocedure('public.consume_rate_limit(text, integer, integer, text)') is not null then
    perform public.consume_rate_limit('admin_destructive', 3, 60, 'role:' || p_profile_id::text);
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if v_new_role not in ('super_admin', 'owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid staff role.';
  end if;

  select role
  into v_old_role
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if (v_new_role in ('super_admin', 'owner') or lower(coalesce(v_old_role, '')) in ('super_admin', 'owner'))
    and not public.is_vrena_super_admin()
  then
    raise exception 'Owner or Super Admin access required.';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'role_updated',
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', v_new_role)
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'old_role', v_old_role,
    'role', v_new_role
  );
end;
$$;

revoke all on function public.staff_role_rank(text, text) from public;
revoke all on function public.current_staff_role_rank() from public;
revoke all on function public.is_vrena_admin() from public;
revoke all on function public.is_vrena_super_admin() from public;
revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;

grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;
grant execute on function public.is_vrena_admin() to authenticated, service_role;
grant execute on function public.is_vrena_super_admin() to authenticated, service_role;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;
