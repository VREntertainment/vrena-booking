begin;

-- Web accounts and employee kiosk permissions are separate concepts.
-- Owner/Admin/Office Staff/Viewer remain web-app roles. Employees receive
-- Manager or Staff permissions only after entering their PIN on the shared
-- contact@vre-vietnam.com store account.
create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
set search_path = pg_catalog
as $$
  select case
    when lower(coalesce(p_email, '')) = 'emilejacquet@icloud.com' then 120
    when lower(coalesce(p_email, '')) = 'emile@vre-vietnam.com' then 100
    when lower(coalesce(p_role, '')) in ('super_admin', 'owner') then 120
    when lower(coalesce(p_role, '')) = 'admin' then 100
    when lower(coalesce(p_role, '')) in ('cashier', 'viewer') then 20
    else 0
  end;
$$;

create or replace function public.current_staff_role_key()
returns text
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_profile_role text;
  v_rank integer := 0;
begin
  if v_actor is null then
    return 'player';
  end if;

  select lower(users.email), profiles.role
  into v_auth_email, v_profile_role
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
   and profiles.deleted_at is null
  where users.id = v_actor;

  if coalesce(v_auth_email, v_jwt_email, '') = 'contact@vre-vietnam.com'
     or v_jwt_email = 'contact@vre-vietnam.com' then
    return coalesce(private.current_staff_kiosk_role_key(), 'player');
  end if;

  v_rank := greatest(
    public.staff_role_rank(v_profile_role, null),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, v_jwt_email)
  );

  if v_rank >= 120 then return 'owner'; end if;
  if v_rank >= 100 then return 'admin'; end if;
  if lower(coalesce(v_profile_role, '')) = 'cashier' then return 'cashier'; end if;
  if v_rank >= 20 then return 'viewer'; end if;
  return 'player';
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_role text := lower(nullif(btrim(coalesce(new.role, 'player')), ''));
  v_old_role text := case
    when tg_op = 'UPDATE' then lower(nullif(btrim(coalesce(old.role, 'player')), ''))
    else null
  end;
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if v_new_role is null then
    v_new_role := 'player';
  end if;

  if v_new_role = 'super_admin' then
    v_new_role := 'owner';
  end if;

  if v_old_role = 'super_admin' then
    v_old_role := 'owner';
  end if;

  if v_new_role not in ('owner', 'admin', 'cashier', 'viewer', 'player', 'employee') then
    raise exception 'Invalid profile role.';
  end if;

  if tg_op = 'INSERT' then
    if v_new_role <> 'player' and not v_is_service_role and v_actor_rank < 100 then
      new.role := 'player';
    else
      new.role := v_new_role;
    end if;
    return new;
  end if;

  -- A one-way downgrade for the legacy account roles. This exception cannot
  -- grant access and lets the data migration run with every trigger enabled.
  if v_old_role in ('manager', 'staff') and v_new_role = 'employee' then
    new.role := v_new_role;
    return new;
  end if;

  if v_new_role is distinct from v_old_role
    and not v_is_service_role
    and v_actor_rank < 100
  then
    raise exception 'Admin access required to change profile roles.';
  end if;

  new.role := v_new_role;
  return new;
end;
$$;

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_auth_email text := nullif(lower(auth.jwt() ->> 'email'), '');
  v_is_legacy_employee_downgrade boolean := false;
begin
  if v_is_service_role then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_actor_rank < 100 then
      new.role := 'player';
      new.email := coalesce(v_auth_email, lower(nullif(new.email, '')));
      new.score_adjustment := 0;
      new.loyalty_points_total := 0;
      new.deleted_at := null;
      new.deleted_by := null;
      new.delete_reason := null;
      new.banned_at := null;
      new.banned_by := null;
      new.ban_reason := null;
      new.is_seed_demo := false;
      new.seed_batch := null;
    end if;

    return new;
  end if;

  v_is_legacy_employee_downgrade :=
    lower(coalesce(old.role, '')) in ('manager', 'staff')
    and lower(coalesce(new.role, '')) = 'employee'
    and new.email is not distinct from old.email
    and new.score_adjustment is not distinct from old.score_adjustment
    and new.loyalty_points_total is not distinct from old.loyalty_points_total
    and new.deleted_at is not distinct from old.deleted_at
    and new.deleted_by is not distinct from old.deleted_by
    and new.delete_reason is not distinct from old.delete_reason
    and new.banned_at is not distinct from old.banned_at
    and new.banned_by is not distinct from old.banned_by
    and new.ban_reason is not distinct from old.ban_reason
    and new.is_seed_demo is not distinct from old.is_seed_demo
    and new.seed_batch is not distinct from old.seed_batch;

  if v_actor_rank < 100 and not v_is_legacy_employee_downgrade and (
    new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.score_adjustment is distinct from old.score_adjustment
    or new.loyalty_points_total is distinct from old.loyalty_points_total
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.delete_reason is distinct from old.delete_reason
    or new.banned_at is distinct from old.banned_at
    or new.banned_by is distinct from old.banned_by
    or new.ban_reason is distinct from old.ban_reason
    or new.is_seed_demo is distinct from old.is_seed_demo
    or new.seed_batch is distinct from old.seed_batch
  ) then
    raise exception 'Admin access required to change protected profile fields.';
  end if;

  return new;
end;
$$;

create or replace function public.set_staff_profile_role(
  p_profile_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
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

  if v_new_role = 'super_admin' then
    v_new_role := 'owner';
  end if;

  if v_new_role not in ('owner', 'admin', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid web-app role.';
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

  if (v_new_role = 'owner' or lower(coalesce(v_old_role, '')) in ('super_admin', 'owner'))
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

create or replace function private.guard_hr_only_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if coalesce(new.is_hr_record_only, false) then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'Service role required to create or change an HR-only identity.';
    end if;

    new.role := 'employee';
    new.email := null;
    new.phone := null;
    new.nickname := null;
    new.marketing_consent := false;
    new.marketing_consent_at := null;
    new.marketing_opted_out_at := null;
    new.anonymous_mode := false;
    new.anonymous_callsign := null;
    new.is_seed_demo := false;
    new.seed_batch := null;
    return new;
  end if;

  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'A normal profile must belong to an authenticated user.';
  end if;

  return new;
end;
$$;

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = 'employee',
    updated_at = now()
where lower(coalesce(role, '')) in ('manager', 'staff');

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or lower(role) in ('owner', 'admin', 'cashier', 'viewer', 'player', 'employee')
  ) not valid;

alter table public.profiles validate constraint profiles_role_check;

revoke all on function public.staff_role_rank(text, text) from public;
revoke all on function public.current_staff_role_key() from public, anon;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.protect_profile_sensitive_fields() from public, anon, authenticated;
revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;
revoke all on function private.guard_hr_only_profile_identity() from public, anon, authenticated;

grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
grant execute on function public.current_staff_role_key() to authenticated, service_role;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;

comment on function public.staff_role_rank(text, text) is
  'Ranks authenticated web-app roles only. Manager and Staff permissions are derived from employee PIN sessions.';
comment on column public.profiles.role is
  'Authenticated web-app role. Employee is a non-privileged HR identity whose operational access comes from a kiosk PIN.';

notify pgrst, 'reload schema';

commit;
