alter table public.profiles
  add column if not exists anonymous_mode boolean not null default false,
  add column if not exists anonymous_callsign text;

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

create or replace function public.profile_anonymous_callsign(p_profile_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['ECHO', 'NOVA', 'ORION', 'CIPHER', 'PHANTOM', 'VORTEX', 'NEON', 'PULSE'])[
      (abs(hashtext(coalesce(p_profile_id::text, 'private-player'))::bigint) % 8) + 1
    ]
    || '-'
    || lpad(((abs(hashtext(coalesce(p_profile_id::text, 'private-player'))::bigint) % 900) + 100)::text, 3, '0');
$$;

create or replace function public.profile_public_display_name(
  p_profile_id uuid,
  p_nickname text,
  p_full_name text,
  p_phone text,
  p_anonymous_mode boolean,
  p_anonymous_callsign text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_anonymous_mode, false) then coalesce(
      nullif(trim(p_nickname), ''),
      nullif(trim(p_anonymous_callsign), ''),
      public.profile_anonymous_callsign(p_profile_id)
    )
    else coalesce(
      nullif(trim(p_nickname), ''),
      nullif(trim(p_full_name), ''),
      nullif(trim(p_phone), ''),
      'Player'
    )
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

  select users.email
  into v_auth_email
  from auth.users
  where users.id = v_actor;

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

create or replace function public.is_staff_console_user(p_min_rank integer default 20)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= p_min_rank;
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

create or replace function public.sync_profile_public_snapshot(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_display_name text;
  v_avatar_url text;
  v_avatar_emoji text;
  v_avatar_initials text;
  v_avatar_color text;
  v_avatar_text_color text;
begin
  if p_profile_id is distinct from auth.uid() and not public.is_vrena_admin() then
    raise exception 'Not authorized';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_profile_id
    and deleted_at is null;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  v_display_name := public.profile_public_display_name(
    v_profile.id,
    v_profile.nickname,
    v_profile.full_name,
    v_profile.phone,
    v_profile.anonymous_mode,
    v_profile.anonymous_callsign
  );

  if coalesce(v_profile.anonymous_mode, false) then
    v_avatar_url := null;
    v_avatar_emoji := '🎭';
    v_avatar_initials := null;
    v_avatar_color := '#11181b';
    v_avatar_text_color := '#ffffff';
  else
    v_avatar_url := v_profile.avatar_url;
    v_avatar_emoji := v_profile.avatar_emoji;
    v_avatar_initials := v_profile.avatar_initials;
    v_avatar_color := v_profile.avatar_color;
    v_avatar_text_color := v_profile.avatar_text_color;
  end if;

  update public.session_participants
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where profile_id = p_profile_id;

  if to_regclass('public.session_waitlist') is not null then
    execute $query$
      update public.session_waitlist
      set display_name = $1,
          avatar_url = $2,
          avatar_emoji = $3,
          avatar_initials = $4,
          avatar_color = $5,
          avatar_text_color = $6,
          profile_motto = $7
      where profile_id = $8
    $query$
    using v_display_name, v_avatar_url, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color, v_profile.profile_motto, p_profile_id;
  end if;

  update public.club_members
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where profile_id = p_profile_id;

  if to_regclass('public.tournament_editors') is not null then
    execute $query$
      update public.tournament_editors
      set display_name = $1,
          avatar_url = $2,
          avatar_emoji = $3,
          avatar_initials = $4,
          avatar_color = $5,
          avatar_text_color = $6,
          profile_motto = $7
      where profile_id = $8
    $query$
    using v_display_name, v_avatar_url, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color, v_profile.profile_motto, p_profile_id;
  end if;

  if to_regclass('public.user_follows') is not null then
    execute $query$
      update public.user_follows
      set display_name = $1,
          avatar_url = $2,
          avatar_emoji = $3,
          avatar_initials = $4,
          avatar_color = $5,
          avatar_text_color = $6,
          profile_motto = $7
      where following_id = $8
    $query$
    using v_display_name, v_avatar_url, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color, v_profile.profile_motto, p_profile_id;
  end if;

  if to_regclass('public.session_invites') is not null then
    execute $query$
      update public.session_invites
      set recipient_display_name = $1,
          recipient_avatar_url = $2,
          recipient_avatar_emoji = $3,
          recipient_avatar_initials = $4,
          recipient_avatar_color = $5,
          recipient_avatar_text_color = $6,
          recipient_profile_motto = $7
      where recipient_id = $8
    $query$
    using v_display_name, v_avatar_url, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color, v_profile.profile_motto, p_profile_id;
  end if;

  if to_regclass('public.sessions') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sessions'
        and column_name = 'booking_type'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sessions'
        and column_name = 'challenge_target_id'
    )
  then
    execute $query$
      update public.sessions as challenge_sessions
      set name = 'Challenge - '
          || public.profile_public_display_name(
            owner_profile.id,
            owner_profile.nickname,
            owner_profile.full_name,
            owner_profile.phone,
            owner_profile.anonymous_mode,
            owner_profile.anonymous_callsign
          )
          || ' vs '
          || public.profile_public_display_name(
            target_profile.id,
            target_profile.nickname,
            target_profile.full_name,
            target_profile.phone,
            target_profile.anonymous_mode,
            target_profile.anonymous_callsign
          )
      from public.profiles as owner_profile,
           public.profiles as target_profile
      where challenge_sessions.booking_type = 'challenge'
        and owner_profile.id = challenge_sessions.owner_id
        and target_profile.id = challenge_sessions.challenge_target_id
        and (
          challenge_sessions.owner_id = $1
          or challenge_sessions.challenge_target_id = $1
        )
    $query$
    using p_profile_id;
  end if;

  if to_regclass('public.session_messages') is not null then
    execute $query$
      update public.session_messages
      set author_display_name = $1,
          author_avatar_url = $2,
          author_avatar_emoji = $3,
          author_avatar_initials = $4,
          author_avatar_color = $5,
          author_avatar_text_color = $6,
          author_profile_motto = $7
      where author_id = $8
    $query$
    using v_display_name, v_avatar_url, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color, v_profile.profile_motto, p_profile_id;
  end if;
end;
$$;

revoke all on function public.staff_role_rank(text, text) from public;
revoke all on function public.profile_anonymous_callsign(uuid) from public;
revoke all on function public.profile_public_display_name(uuid, text, text, text, boolean, text) from public;
revoke all on function public.current_staff_role_rank() from public;
revoke all on function public.is_staff_console_user(integer) from public;
revoke all on function public.is_vrena_admin() from public;
revoke all on function public.is_vrena_super_admin() from public;
revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;
revoke all on function public.sync_profile_public_snapshot(uuid) from public, anon;

grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
grant execute on function public.profile_anonymous_callsign(uuid) to authenticated, service_role;
grant execute on function public.profile_public_display_name(uuid, text, text, text, boolean, text) to authenticated, service_role;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;
grant execute on function public.is_staff_console_user(integer) to authenticated, service_role;
grant execute on function public.is_vrena_admin() to authenticated, service_role;
grant execute on function public.is_vrena_super_admin() to authenticated, service_role;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;
grant execute on function public.sync_profile_public_snapshot(uuid) to authenticated, service_role;
