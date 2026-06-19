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
    when lower(coalesce(p_email, '')) in ('emile@vre-vietnam.com', 'emilejacquet@icloud.com') then 120
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
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_profile_email text;
  v_profile_role text;
begin
  if v_actor is null then
    return 0;
  end if;

  begin
    select users.email
    into v_auth_email
    from auth.users
    where users.id = v_actor;
  exception
    when others then
      v_auth_email := null;
  end;

  select profiles.email, profiles.role
  into v_profile_email, v_profile_role
  from public.profiles
  where profiles.id = v_actor
    and profiles.deleted_at is null;

  return greatest(
    public.staff_role_rank(v_profile_role, v_profile_email),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, nullif(auth.jwt() ->> 'email', ''))
  );
end;
$$;

update public.profiles
set role = 'owner',
    updated_at = now()
where lower(coalesce(email, '')) in ('emile@vre-vietnam.com', 'emilejacquet@icloud.com')
  and deleted_at is null
  and lower(coalesce(role, '')) <> 'owner';

update public.profiles
set role = 'admin',
    updated_at = now()
where lower(coalesce(email, '')) = 'contact@vre-vietnam.com'
  and deleted_at is null
  and lower(coalesce(role, '')) not in ('owner', 'super_admin', 'admin');

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
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_saved_role text;
begin
  if v_actor is null or v_actor_rank < 100 then
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
    and v_actor_rank < 120
  then
    raise exception 'Owner access required.';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning role into v_saved_role;

  if v_saved_role is distinct from v_new_role then
    raise exception 'Role update failed.';
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'role_updated',
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', v_saved_role)
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'old_role', v_old_role,
    'role', v_saved_role
  );
end;
$$;

grant update (role, updated_at) on public.profiles to authenticated;

drop policy if exists "staff admins update profile roles" on public.profiles;
create policy "staff admins update profile roles"
on public.profiles
for update
to authenticated
using (
  public.is_vrena_admin()
  and (
    lower(coalesce(role, '')) not in ('super_admin', 'owner')
    or public.is_vrena_super_admin()
  )
)
with check (
  public.is_vrena_admin()
  and (
    lower(coalesce(role, '')) not in ('super_admin', 'owner')
    or public.is_vrena_super_admin()
  )
);

revoke all on function public.staff_role_rank(text, text) from public;
revoke all on function public.current_staff_role_rank() from public;
revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;

grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
