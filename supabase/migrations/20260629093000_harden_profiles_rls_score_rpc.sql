begin;

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

  select profiles.role
  into v_profile_role
  from public.profiles
  where profiles.id = v_actor
    and profiles.deleted_at is null;

  return greatest(
    public.staff_role_rank(v_profile_role, null),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, nullif(auth.jwt() ->> 'email', ''))
  );
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

  select role
  into v_profile_role
  from public.profiles
  where id = v_actor
    and deleted_at is null;

  v_rank := greatest(
    public.staff_role_rank(v_profile_role, null),
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

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_auth_email text := nullif(lower(auth.jwt() ->> 'email'), '');
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

  if v_actor_rank < 100 and (
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

drop trigger if exists profiles_protect_sensitive_fields on public.profiles;
create trigger profiles_protect_sensitive_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_sensitive_fields();

create or replace function public.set_profile_score_adjustment(
  p_profile_id uuid,
  p_score_adjustment integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_score integer;
  v_saved_score integer;
begin
  if v_actor is null or v_actor_rank < 100 then
    raise exception 'Admin access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_score_adjustment is null then
    raise exception 'Score adjustment is required.';
  end if;

  select score_adjustment
  into v_old_score
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set score_adjustment = p_score_adjustment,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning score_adjustment into v_saved_score;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'score_adjustment_updated',
      'profile',
      p_profile_id,
      jsonb_build_object('score_adjustment', v_old_score),
      jsonb_build_object('score_adjustment', v_saved_score)
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'score_adjustment', v_saved_score
  );
end;
$$;

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

drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Anyone can create profiles" on public.profiles;
drop policy if exists "Users insert their own profile" on public.profiles;
drop policy if exists "Users update their own profile" on public.profiles;
drop policy if exists "Users delete their own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "admins update profile score adjustment" on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id and deleted_at is null);

create policy "Staff can view profiles"
on public.profiles
for select
to authenticated
using (public.current_staff_role_rank() >= 20 and deleted_at is null);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id and deleted_at is null);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id and deleted_at is null)
with check ((select auth.uid()) = id and deleted_at is null);

revoke select, insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;

grant select on public.profiles to authenticated;
grant insert on public.profiles to authenticated;

do $$
declare
  v_column text;
  v_safe_update_columns text[] := array[
    'full_name',
    'nickname',
    'phone',
    'birthday',
    'avatar_url',
    'avatar_emoji',
    'avatar_initials',
    'avatar_color',
    'avatar_text_color',
    'profile_motto',
    'anonymous_mode',
    'anonymous_callsign',
    'marketing_consent',
    'marketing_consent_at',
    'marketing_opted_out_at',
    'personal_data_consent',
    'personal_data_consent_at',
    'privacy_policy_url',
    'updated_at'
  ];
begin
  foreach v_column in array v_safe_update_columns loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = v_column
    ) then
      execute format('grant update (%I) on public.profiles to authenticated', v_column);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.profiles to service_role;

revoke all on function public.protect_profile_sensitive_fields() from public, anon, authenticated;
revoke all on function public.set_profile_score_adjustment(uuid, integer) from public, anon;
revoke all on function public.public_profile_search(text, integer) from public, anon;
grant execute on function public.set_profile_score_adjustment(uuid, integer) to authenticated, service_role;
grant execute on function public.public_profile_search(text, integer) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
