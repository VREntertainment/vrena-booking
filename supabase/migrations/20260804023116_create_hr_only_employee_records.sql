begin;

-- HR records need a stable UUID for attendance, payroll, documents, and kiosk
-- access, but they must not create a player login in auth.users.
alter table public.profiles
  add column if not exists is_hr_record_only boolean not null default false;

comment on column public.profiles.is_hr_record_only is
  'Internal HR identity without an auth.users login. Created only by the service-role HR employee API.';

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

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

    new.role := 'staff';
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

revoke all on function private.guard_hr_only_profile_identity() from public, anon, authenticated;

drop trigger if exists profiles_hr_only_identity_guard on public.profiles;
create trigger profiles_hr_only_identity_guard
before insert or update of is_hr_record_only on public.profiles
for each row execute function private.guard_hr_only_profile_identity();

create or replace function private.delete_profile_after_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.profiles
  where id = old.id
    and not coalesce(is_hr_record_only, false);
  return old;
end;
$$;

revoke all on function private.delete_profile_after_auth_user() from public, anon, authenticated;

drop trigger if exists delete_profile_after_auth_user on auth.users;
create trigger delete_profile_after_auth_user
after delete on auth.users
for each row execute function private.delete_profile_after_auth_user();

-- HR-only names are private employment data, not player display identities.
create or replace function public.enforce_unique_player_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_id uuid;
  v_full_name text := public.normalize_player_identity(new.full_name);
  v_identity text;
  v_nickname text := public.normalize_player_identity(new.nickname);
begin
  if new.deleted_at is not null or coalesce(new.is_hr_record_only, false) then
    return new;
  end if;

  for v_identity in
    select distinct identity_value
    from unnest(array[v_full_name, v_nickname]) as identity_values(identity_value)
    where identity_value is not null
    order by identity_value
  loop
    perform pg_advisory_xact_lock(hashtextextended('profile_identity:' || v_identity, 0));
  end loop;

  select profiles.id
  into v_conflict_id
  from public.profiles
  where profiles.deleted_at is null
    and not coalesce(profiles.is_hr_record_only, false)
    and profiles.id is distinct from new.id
    and (
      public.normalize_player_identity(profiles.full_name) in (v_full_name, v_nickname)
      or public.normalize_player_identity(profiles.nickname) in (v_full_name, v_nickname)
    )
  limit 1;

  if v_conflict_id is not null then
    raise exception using
      errcode = '23505',
      message = 'Player name or nickname is already in use.';
  end if;

  return new;
end;
$$;

-- Player search must never surface private HR-only identities.
create or replace function public.public_profile_search(
  p_search text default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  full_name text,
  nickname text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  if v_search is null or length(v_search) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    public.profile_public_display_name(
      p.id,
      p.nickname,
      p.full_name,
      p.phone,
      p.anonymous_mode,
      p.anonymous_callsign
    ) as full_name,
    null::text as nickname,
    case when coalesce(p.anonymous_mode, false) then null else p.avatar_url end as avatar_url,
    case when coalesce(p.anonymous_mode, false) then '🎭' else p.avatar_emoji end as avatar_emoji,
    case when coalesce(p.anonymous_mode, false) then null else p.avatar_initials end as avatar_initials,
    case when coalesce(p.anonymous_mode, false) then '#11181b' else p.avatar_color end as avatar_color,
    case when coalesce(p.anonymous_mode, false) then '#ffffff' else p.avatar_text_color end as avatar_text_color,
    p.profile_motto
  from public.profiles p
  where p.deleted_at is null
    and not coalesce(p.is_seed_demo, false)
    and not coalesce(p.is_hr_record_only, false)
    and (
      lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
      or lower(coalesce(p.nickname, '')) like '%' || v_search || '%'
      or lower(coalesce(p.email, '')) = v_search
    )
  order by
    lower(coalesce(p.nickname, p.full_name, p.email, '')) asc,
    p.id asc
  limit v_limit;
end;
$$;

revoke all on function public.public_profile_search(text, integer) from public, anon;
grant execute on function public.public_profile_search(text, integer) to authenticated, service_role;

create or replace function public.staff_hr_create_employee_record(
  p_actor_user_id uuid,
  p_full_name text,
  p_personal_email text,
  p_personal_phone text,
  p_employment_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  v_actor_email text;
  v_actor_role text;
  v_employee public.staff_employee_profiles;
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_personal_email text := nullif(lower(btrim(coalesce(p_personal_email, ''))), '');
  v_personal_phone text := nullif(btrim(coalesce(p_personal_phone, '')), '');
  v_profile public.profiles;
  v_profile_id uuid := extensions.gen_random_uuid();
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  select lower(users.email), profiles.role
  into v_actor_email, v_actor_role
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
   and profiles.deleted_at is null
  where users.id = p_actor_user_id;

  if v_actor_email is null then
    raise exception 'Staff session required.';
  end if;
  if v_actor_email = 'contact@vre-vietnam.com' then
    raise exception 'Sign in with an individual Owner or Admin account to create employees.';
  end if;
  if public.staff_role_rank(v_actor_role, v_actor_email) < 100 then
    raise exception 'Administrator access required.';
  end if;
  if v_full_name is null then
    raise exception 'Enter the employee name.';
  end if;
  if length(v_full_name) > 120 then
    raise exception 'Employee name is too long.';
  end if;
  if v_personal_email is not null and length(v_personal_email) > 254 then
    raise exception 'Email is too long.';
  end if;
  if v_personal_email is not null and v_personal_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email or leave it blank.';
  end if;
  if v_personal_phone is not null and length(v_personal_phone) > 40 then
    raise exception 'Phone number is too long.';
  end if;
  if p_employment_type not in ('full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern') then
    raise exception 'Choose a valid employment type.';
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    marketing_consent,
    is_hr_record_only
  ) values (
    v_profile_id,
    v_full_name,
    'staff',
    false,
    true
  )
  returning * into v_profile;

  insert into public.staff_employee_profiles (
    active,
    created_by,
    employment_type,
    job_title,
    legal_name,
    personal_email,
    personal_phone,
    profile_id
  ) values (
    true,
    p_actor_user_id,
    p_employment_type,
    'Staff',
    v_full_name,
    v_personal_email,
    v_personal_phone,
    v_profile_id
  )
  returning * into v_employee;

  insert into public.audit_logs (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    new_value
  ) values (
    'employee_hr_record_created',
    p_actor_user_id,
    v_profile_id,
    'staff_employee_profiles',
    jsonb_build_object(
      'employment_type', p_employment_type,
      'full_name', v_full_name,
      'hr_record_only', true
    )
  );

  return jsonb_build_object(
    'employee', to_jsonb(v_employee),
    'profile', to_jsonb(v_profile)
  );
end;
$$;

revoke all on function public.staff_hr_create_employee_record(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.staff_hr_create_employee_record(uuid, text, text, text, text) to service_role;

grant select (is_hr_record_only) on public.profiles to authenticated;

notify pgrst, 'reload schema';

commit;
