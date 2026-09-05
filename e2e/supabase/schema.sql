


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "private"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_member_profile_id = (select auth.uid())
    and exists (
      select 1
      from public.clubs c
      where c.id = p_club_id
        and (
          (c.owner_id = (select auth.uid()) and p_status = 'approved')
          or (c.visibility = 'public' and p_status = 'approved')
          or (c.visibility = 'private' and p_status = 'pending')
        )
    );
$$;


ALTER FUNCTION "private"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_join_session_row"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (select auth.uid()) is not null
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.sessions s
      where s.id = p_session_id
        and s.deleted_at is null
        and s.status = 'open'
        and s.booking_type <> 'ticket'
        and (
          select count(*)
          from public.session_participants active_participant
          where active_participant.session_id = s.id
            and active_participant.deleted_at is null
        ) < s.max_players
        and (
          s.owner_id = (select auth.uid())
          or coalesce(public.current_staff_role_rank(), 0) >= 50
          or (
            s.club_id is null
            and (
              s.visibility = 'public'
              or exists (
                select 1
                from public.session_invites si
                where si.session_id = s.id
                  and si.recipient_id = (select auth.uid())
              )
            )
          )
          or (
            s.club_id is not null
            and exists (
              select 1
              from public.club_members cm
              where cm.club_id = s.club_id
                and cm.profile_id = (select auth.uid())
                and cm.status = 'approved'
                and cm.deleted_at is null
            )
          )
        )
    );
$$;


ALTER FUNCTION "private"."can_join_session_row"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_avatar_object_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select auth.uid() is not null
    and split_part(coalesce(p_object_name, ''), '/', 1) = auth.uid()::text
    and split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
    and position('..' in coalesce(p_object_name, '')) = 0;
$_$;


ALTER FUNCTION "private"."can_manage_avatar_object_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_club_banner_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select case
    when split_part(p_object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_manage_club_settings(split_part(p_object_name, '/', 1)::uuid)
    else false
  end;
$_$;


ALTER FUNCTION "private"."can_manage_club_banner_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text" DEFAULT 'member'::"text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with actor as (
    select public.club_member_role(p_club_id, auth.uid()) as role
  ),
  target as (
    select case
      when exists (
        select 1
        from public.clubs
        where clubs.id = p_club_id
          and clubs.owner_id = p_target_profile_id
      ) then 'owner'
      else coalesce(nullif(p_target_role, ''), 'member')
    end as role
  )
  select public.is_vrena_admin()
    or exists (
      select 1
      from actor, target
      where actor.role = 'owner'
        and target.role <> 'owner'
    )
    or exists (
      select 1
      from actor, target
      where actor.role = 'admin'
        and target.role in ('moderator', 'member')
    )
    or exists (
      select 1
      from actor, target
      where actor.role = 'moderator'
        and target.role = 'member'
    );
$$;


ALTER FUNCTION "private"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_club_settings"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_vrena_admin()
    or exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = auth.uid()
        and club_members.status = 'approved'
        and club_members.role = 'admin'
    );
$$;


ALTER FUNCTION "private"."can_manage_club_settings"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_session_row"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(public.current_staff_role_rank(), 0) >= 50
    or exists (
      select 1
      from public.sessions s
      where s.id = p_session_id
        and s.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.tournament_editors te
      where te.session_id = p_session_id
        and te.profile_id = (select auth.uid())
    );
$$;


ALTER FUNCTION "private"."can_manage_session_row"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_staff_game_image_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_staff_console_user(80)
    and coalesce(p_object_name, '') <> '';
$$;


ALTER FUNCTION "private"."can_manage_staff_game_image_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_staff_hr_document_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $_$
  select private.is_hr_administrator()
    and split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
    and position('..' in coalesce(p_object_name, '')) = 0
$_$;


ALTER FUNCTION "private"."can_manage_staff_hr_document_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_tournament"("target_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_session_id
      and (
        s.owner_id = auth.uid()
        or exists (
          select 1 from public.tournament_editors te
          where te.session_id = target_session_id
            and te.profile_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  );
$$;


ALTER FUNCTION "private"."can_manage_tournament"("target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_vrena_admin()
    or p_member_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.clubs c
      where c.id = p_club_id
        and (
          c.visibility = 'public'
          or c.owner_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.profile_id = (select auth.uid())
        and cm.status = 'approved'
        and cm.deleted_at is null
    );
$$;


ALTER FUNCTION "private"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_staff_attendance_row"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
    or p_profile_id = (select auth.uid());
$$;


ALTER FUNCTION "private"."can_read_staff_attendance_row"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_staff_attendance_settings"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer');
$$;


ALTER FUNCTION "private"."can_read_staff_attendance_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_staff_hr_document_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $_$
  select case
    when split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
      and position('..' in coalesce(p_object_name, '')) = 0
    then private.is_hr_administrator()
      or split_part(p_object_name, '/', 1)::uuid = public.current_staff_actor_profile_id()
    else false
  end
$_$;


ALTER FUNCTION "private"."can_read_staff_hr_document_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_use_club_messages"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_vrena_admin()
    or exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = auth.uid()
        and club_members.status = 'approved'
        and club_members.deleted_at is null
    );
$$;


ALTER FUNCTION "private"."can_use_club_messages"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_view_session_row"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
      select 1
      from public.sessions s
      where s.id = p_session_id
        and s.deleted_at is null
        and s.status <> 'cancelled'
        and s.visibility = 'public'
    )
    or public.can_manage_session_row(p_session_id)
    or exists (
      select 1
      from public.session_participants sp
      where sp.session_id = p_session_id
        and sp.profile_id = (select auth.uid())
        and sp.deleted_at is null
    )
    or exists (
      select 1
      from public.session_invites si
      where si.session_id = p_session_id
        and si.recipient_id = (select auth.uid())
    );
$$;


ALTER FUNCTION "private"."can_view_session_row"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_email text;
  v_actor_profile public.profiles%rowtype;
  v_guest_phone text := public.normalize_guest_ticket_phone(p_guest_phone);
  v_ticket_reference text := upper(nullif(btrim(coalesce(p_ticket_reference, '')), ''));
  v_session public.sessions%rowtype;
  v_guest_profile public.profiles%rowtype;
  v_vote text;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  if v_ticket_reference is null then
    raise exception 'Booking reference is required.';
  end if;

  select lower(users.email)
  into v_actor_email
  from auth.users users
  where users.id = v_actor;

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    role,
    score_adjustment,
    anonymous_mode,
    marketing_consent
  )
  values (
    v_actor,
    v_guest_phone,
    null,
    null,
    v_actor_email,
    'player',
    0,
    false,
    false
  )
  on conflict (id) do nothing;

  select *
  into v_actor_profile
  from public.profiles
  where id = v_actor
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if nullif(btrim(coalesce(v_actor_profile.phone, '')), '') is null then
    update public.profiles
    set phone = v_guest_phone,
        updated_at = now()
    where id = v_actor
    returning * into v_actor_profile;
  elsif v_actor_profile.phone <> v_guest_phone then
    raise exception 'This account uses a different phone number.';
  end if;

  select *
  into v_session
  from public.sessions
  where ticket_reference = v_ticket_reference
    and booking_type = 'ticket'
    and ticket_status = 'confirmed'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Ticket booking not found.';
  end if;

  if v_session.owner_id = v_actor and v_session.ticket_customer_id = v_actor then
    perform public.award_staff_order_loyalty(orders.id)
    from public.staff_orders orders
    where orders.session_id = v_session.id;

    return jsonb_build_object(
      'session_id', v_session.id,
      'ticket_reference', v_session.ticket_reference,
      'claimed', true,
      'loyalty_points_total', coalesce(v_actor_profile.loyalty_points_total, 0)
    );
  end if;

  select *
  into v_guest_profile
  from public.profiles
  where id = v_session.ticket_customer_id
    and phone = v_guest_phone
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Ticket booking does not match this phone number.';
  end if;

  if public.profile_has_account(v_guest_profile.id) then
    raise exception 'This booking is already linked to another account.';
  end if;

  v_vote := coalesce(v_session.game_votes ->> v_guest_profile.id::text, v_session.confirmed_game_id::text, 'laser-tag');

  update public.sessions
  set owner_id = v_actor,
      ticket_customer_id = v_actor,
      game_votes = (coalesce(game_votes, '{}'::jsonb) - v_guest_profile.id::text) || jsonb_build_object(v_actor::text, v_vote),
      updated_at = now()
  where id = v_session.id;

  update public.session_participants
  set profile_id = v_actor,
      display_name = coalesce(
        nullif(display_name, ''),
        nullif(v_actor_profile.nickname, ''),
        nullif(v_actor_profile.full_name, ''),
        nullif(v_actor_profile.phone, ''),
        'Player'
      )
  where session_id = v_session.id
    and profile_id = v_guest_profile.id
    and deleted_at is null;

  update public.staff_orders
  set customer_id = v_actor,
      customer_name = coalesce(nullif(v_actor_profile.full_name, ''), nullif(v_actor_profile.nickname, ''), customer_name),
      customer_phone = v_guest_phone,
      customer_email = coalesce(v_actor_profile.email, v_actor_email, customer_email),
      updated_at = now()
  where session_id = v_session.id
    and customer_id = v_guest_profile.id;

  perform public.award_staff_order_loyalty(orders.id)
  from public.staff_orders orders
  where orders.session_id = v_session.id;

  select *
  into v_actor_profile
  from public.profiles
  where id = v_actor;

  return jsonb_build_object(
    'session_id', v_session.id,
    'ticket_reference', v_session.ticket_reference,
    'claimed', true,
    'loyalty_points_total', coalesce(v_actor_profile.loyalty_points_total, 0)
  );
end;
$$;


ALTER FUNCTION "private"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_reset_at timestamptz;
  v_actor text := coalesce((select auth.uid())::text, '');
  v_subject text;
  v_hash_material text;
  v_hash text;
  v_count integer;
begin
  if p_action not in (
    'login_attempt',
    'otp_request',
    'join_leave',
    'booking_attempt',
    'booking_update_email',
    'admin_destructive',
    'password_reset',
    'password_reset_ip',
    'invite_player',
    'session_message',
    'customer_invite',
    'customer_invite_actor',
    'voucher_quote',
    'staff_config_write',
    'product_analytics'
  ) then
    raise exception 'Unknown rate limit action.';
  end if;

  if coalesce(p_limit, 0) < 1 or coalesce(p_window_seconds, 0) < 1 then
    raise exception 'Invalid rate limit configuration.';
  end if;

  v_subject := lower(coalesce(nullif(btrim(p_subject), ''), v_actor, 'anonymous'));
  v_hash_material := lower(p_action) || ':' || v_actor || ':' || v_subject;

  if to_regprocedure('extensions.digest(text, text)') is not null then
    execute 'select encode(extensions.digest($1, $2), ''hex'')'
      into v_hash
      using v_hash_material, 'sha256';
  elsif to_regprocedure('public.digest(text, text)') is not null then
    execute 'select encode(public.digest($1, $2), ''hex'')'
      into v_hash
      using v_hash_material, 'sha256';
  else
    v_hash := md5(v_hash_material);
  end if;

  v_window_started_at := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_window_started_at + make_interval(secs => p_window_seconds);

  delete from public.security_rate_limits
  where reset_at < v_now - interval '1 day';

  insert into public.security_rate_limits (
    subject_hash,
    action,
    window_started_at,
    reset_at,
    attempt_count,
    last_seen_at
  )
  values (
    v_hash,
    p_action,
    v_window_started_at,
    v_reset_at,
    1,
    v_now
  )
  on conflict (subject_hash, action, window_started_at)
  do update
  set attempt_count = public.security_rate_limits.attempt_count + 1,
      last_seen_at = excluded.last_seen_at,
      reset_at = excluded.reset_at
  returning attempt_count into v_count;

  if v_count > p_limit then
    raise exception 'Too many attempts. Please wait a moment and try again.';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_reset_at
  );
end;
$_$;


ALTER FUNCTION "private"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_creator_profile public.profiles%rowtype;
  v_target_profile public.profiles%rowtype;
  v_creator_display_name text;
  v_target_display_name text;
  v_session_id uuid;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_game_id text := coalesce(nullif(p_game_id, ''), 'laser-tag');
begin
  if v_user_id is null then
    raise exception 'Login required to challenge a player.';
  end if;

  if p_target_profile_id is null then
    raise exception 'Challenge target is required.';
  end if;

  if p_target_profile_id = v_user_id then
    raise exception 'You cannot challenge yourself.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_duration_minutes < 20 or p_duration_minutes > 120 or p_duration_minutes % 20 <> 0 then
    raise exception 'Invalid challenge duration.';
  end if;

  if v_game_id not in (
    'laser-tag',
    'mini-block-towers',
    'office-war',
    'paintball',
    'snow-battle',
    'castle-unspunnen',
    'wild-west',
    'arc-of-the-covenant',
    'joller-house'
  ) then
    raise exception 'Invalid game for this challenge.';
  end if;

  select *
  into v_creator_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile required to challenge a player.';
  end if;

  select *
  into v_target_profile
  from public.profiles
  where id = p_target_profile_id;

  if not found then
    raise exception 'Challenge target profile not found.';
  end if;

  v_creator_display_name := public.profile_public_display_name(
    v_creator_profile.id,
    v_creator_profile.nickname,
    v_creator_profile.full_name,
    v_creator_profile.phone,
    v_creator_profile.anonymous_mode,
    v_creator_profile.anonymous_callsign
  );

  v_target_display_name := public.profile_public_display_name(
    v_target_profile.id,
    v_target_profile.nickname,
    v_target_profile.full_name,
    v_target_profile.phone,
    v_target_profile.anonymous_mode,
    v_target_profile.anonymous_callsign
  );

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if (p_date + p_start_time) <= now() then
    raise exception 'Selected time is already past.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where date = p_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_start_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where date = p_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_start_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < 1 then
    raise exception 'Selected time slot is no longer available.';
  end if;

  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    challenge_target_id,
    challenge_status
  ) values (
    v_user_id,
    null,
    'game',
    'Challenge - ' || v_creator_display_name || ' vs ' || v_target_display_name,
    p_date,
    p_start_time,
    p_duration_minutes,
    2,
    1,
    array[v_game_id],
    jsonb_build_object(v_user_id::text, v_game_id),
    v_game_id,
    'private',
    v_invite_code,
    'Invite-only challenge match. Score it after the game.',
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'challenge',
    p_target_profile_id,
    'pending'
  )
  returning id into v_session_id;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto
  ) values (
    v_session_id,
    v_user_id,
    v_creator_display_name,
    case when coalesce(v_creator_profile.anonymous_mode, false) then null else v_creator_profile.avatar_url end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then '🎭' else v_creator_profile.avatar_emoji end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then null else v_creator_profile.avatar_initials end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then '#11181b' else v_creator_profile.avatar_color end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then '#ffffff' else v_creator_profile.avatar_text_color end,
    v_creator_profile.profile_motto
  );

  insert into public.session_invites (
    session_id,
    inviter_id,
    recipient_id,
    recipient_display_name,
    recipient_avatar_url,
    recipient_avatar_emoji,
    recipient_avatar_initials,
    recipient_avatar_color,
    recipient_avatar_text_color,
    recipient_profile_motto,
    status
  ) values (
    v_session_id,
    v_user_id,
    p_target_profile_id,
    v_target_display_name,
    case when coalesce(v_target_profile.anonymous_mode, false) then null else v_target_profile.avatar_url end,
    case when coalesce(v_target_profile.anonymous_mode, false) then '🎭' else v_target_profile.avatar_emoji end,
    case when coalesce(v_target_profile.anonymous_mode, false) then null else v_target_profile.avatar_initials end,
    case when coalesce(v_target_profile.anonymous_mode, false) then '#11181b' else v_target_profile.avatar_color end,
    case when coalesce(v_target_profile.anonymous_mode, false) then '#ffffff' else v_target_profile.avatar_text_color end,
    v_target_profile.profile_motto,
    'pending'
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'booking_type', 'challenge',
    'challenge_status', 'pending'
  );
end;
$$;


ALTER FUNCTION "private"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."current_staff_kiosk_operator_profile_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
  select session.operator_profile_id
  from private.staff_kiosk_operator_sessions as session
  where session.id = private.current_staff_kiosk_session_id()
$$;


ALTER FUNCTION "private"."current_staff_kiosk_operator_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."current_staff_kiosk_role_key"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
  select session.access_role
  from private.staff_kiosk_operator_sessions as session
  where session.id = private.current_staff_kiosk_session_id()
$$;


ALTER FUNCTION "private"."current_staff_kiosk_role_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."current_staff_kiosk_role_rank"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
  select case private.current_staff_kiosk_role_key()
    when 'manager' then 80
    when 'staff' then 50
    else 0
  end
$$;


ALTER FUNCTION "private"."current_staff_kiosk_role_rank"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."current_staff_kiosk_session_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
  select session.id
  from private.staff_kiosk_operator_sessions as session
  join private.staff_kiosk_pin_credentials as credential
    on credential.profile_id = session.operator_profile_id
  join public.staff_employee_profiles as employee
    on employee.profile_id = session.operator_profile_id
  join auth.users as shared_user
    on shared_user.id = session.auth_user_id
  where session.auth_user_id = (select auth.uid())
    and lower(shared_user.email) = 'contact@vre-vietnam.com'
    and session.token_hash = private.staff_kiosk_request_token_hash()
    and session.revoked_at is null
    and session.last_activity_at > now() - interval '5 minutes'
    and session.expires_at > now()
    and employee.active = true
    and employee.deleted_at is null
    and credential.access_role = session.access_role
  order by session.last_activity_at desc
  limit 1
$$;


ALTER FUNCTION "private"."current_staff_kiosk_session_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."delete_profile_after_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  delete from public.profiles
  where id = old.id
    and not coalesce(is_hr_record_only, false);
  return old;
end;
$$;


ALTER FUNCTION "private"."delete_profile_after_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."enforce_staff_kiosk_department_eligibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'vault'
    AS $$
declare
  v_was_eligible boolean;
  v_is_eligible boolean;
begin
  v_was_eligible := case
    when tg_op = 'UPDATE' then private.staff_kiosk_department_is_eligible(old.department)
    else false
  end;
  v_is_eligible := private.staff_kiosk_department_is_eligible(new.department);

  if v_is_eligible then
    return new;
  end if;

  if tg_op = 'UPDATE' and v_was_eligible and old.department is distinct from new.department then
    update private.staff_kiosk_operator_sessions
    set revoked_at = now(),
        revoked_reason = 'employee_group_not_kiosk_eligible'
    where operator_profile_id = new.profile_id
      and revoked_at is null;

    new.kiosk_access_role := null;
    new.kiosk_pin_configured_at := null;
    return new;
  end if;

  if new.kiosk_access_role is not null or new.kiosk_pin_configured_at is not null then
    raise exception 'Store PIN access is limited to VRena and Manager employees.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."enforce_staff_kiosk_department_eligibility"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_duplicate_ticket_booking"("p_venue_key" "text", "p_customer_id" "uuid", "p_guest_phone" "text", "p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_phone text;
  v_identity text;
begin
  if p_customer_id is not null then
    select regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g')
    into v_phone
    from public.profiles
    where id = p_customer_id;
  else
    v_phone := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  end if;
  v_phone := regexp_replace(coalesce(v_phone, ''), '(?!^)\+', '', 'g');
  v_identity := coalesce(nullif(v_phone, ''), p_customer_id::text);
  if v_identity is null or p_date is null or p_start_time is null then
    return; -- The booking function supplies its existing validation errors.
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array('ticket-submission', p_venue_key, v_identity, p_date, p_start_time)::text, 0
  ));

  -- A separate query after the lock sees the preceding transaction's committed row.
  if exists (
    select 1
    from public.sessions s
    join public.profiles p on p.id = s.ticket_customer_id
    where s.booking_type = 'ticket'
      and s.venue_key = p_venue_key
      and (s.ticket_customer_id = p_customer_id
        or (v_phone <> '' and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone))
      and s.date = p_date
      and s.start_time = p_start_time
      and s.duration_minutes = p_duration_minutes
      and s.ticket_type = p_ticket_type
      and s.ticket_player_count = p_player_count
      and s.arena_count = p_arena_count
      and s.deleted_at is null
      and s.status = 'open'
      and s.ticket_status in ('pending', 'confirmed')
      and s.created_at >= clock_timestamp() - interval '2 minutes'
  ) then
    -- Never disclose another guest's booking reference or account-claim credential.
    raise exception 'This booking was already submitted. Please check your confirmation or contact the shop before booking again.';
  end if;
end;
$$;


ALTER FUNCTION "private"."guard_duplicate_ticket_booking"("p_venue_key" "text", "p_customer_id" "uuid", "p_guest_phone" "text", "p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_hr_only_profile_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'auth'
    AS $$
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


ALTER FUNCTION "private"."guard_hr_only_profile_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_hr_administrator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
  select public.current_staff_role_key() in ('owner', 'admin')
$$;


ALTER FUNCTION "private"."is_hr_administrator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_staff_attendance_editor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_staff_role_key() in ('owner', 'admin', 'cashier');
$$;


ALTER FUNCTION "private"."is_staff_attendance_editor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_staff_console_user"("p_min_rank" integer DEFAULT 20) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_staff_role_rank() >= p_min_rank;
$$;


ALTER FUNCTION "private"."is_staff_console_user"("p_min_rank" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_vrena_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_staff_role_rank() >= 100;
$$;


ALTER FUNCTION "private"."is_vrena_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_vrena_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_staff_role_rank() >= 120;
$$;


ALTER FUNCTION "private"."is_vrena_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_avatar_emoji" "text" DEFAULT NULL::"text", "p_avatar_initials" "text" DEFAULT NULL::"text", "p_avatar_color" "text" DEFAULT NULL::"text", "p_avatar_text_color" "text" DEFAULT NULL::"text", "p_profile_motto" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_session public.sessions%rowtype;
begin
  if v_actor is null
    or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
  then
    raise exception 'A permanent account is required.';
  end if;

  select *
  into v_session
  from public.sessions s
  where s.id = p_session_id
    and s.deleted_at is null
    and s.status = 'open'
    and s.visibility = 'private'
    and s.booking_type <> 'ticket'
  limit 1;

  if v_session.id is null then
    raise exception 'Private session not found.';
  end if;

  if nullif(upper(btrim(coalesce(p_invite_code, ''))), '') is null
    or upper(btrim(coalesce(v_session.invite_code, ''))) <> upper(btrim(coalesce(p_invite_code, '')))
  then
    raise exception 'Incorrect private session code.';
  end if;

  if exists (
    select 1
    from public.session_waitlist sw
    where sw.session_id = p_session_id
      and sw.profile_id = v_actor
  ) then
    return;
  end if;

  insert into public.session_waitlist (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto
  )
  values (
    p_session_id,
    v_actor,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_avatar_url, '')), ''),
    nullif(btrim(coalesce(p_avatar_emoji, '')), ''),
    nullif(btrim(coalesce(p_avatar_initials, '')), ''),
    nullif(btrim(coalesce(p_avatar_color, '')), ''),
    nullif(btrim(coalesce(p_avatar_text_color, '')), ''),
    nullif(btrim(coalesce(p_profile_motto, '')), '')
  );
end;
$$;


ALTER FUNCTION "private"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_avatar_emoji" "text" DEFAULT NULL::"text", "p_avatar_initials" "text" DEFAULT NULL::"text", "p_avatar_color" "text" DEFAULT NULL::"text", "p_avatar_text_color" "text" DEFAULT NULL::"text", "p_profile_motto" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_session public.sessions%rowtype;
  v_participant_count integer := 0;
begin
  if v_actor is null
    or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
  then
    raise exception 'A permanent account is required.';
  end if;

  select *
  into v_session
  from public.sessions s
  where s.id = p_session_id
    and s.deleted_at is null
    and s.status = 'open'
    and s.visibility = 'private'
    and s.booking_type <> 'ticket'
  limit 1;

  if v_session.id is null then
    raise exception 'Private session not found.';
  end if;

  if nullif(upper(btrim(coalesce(p_invite_code, ''))), '') is null
    or upper(btrim(coalesce(v_session.invite_code, ''))) <> upper(btrim(coalesce(p_invite_code, '')))
  then
    raise exception 'Incorrect private session code.';
  end if;

  if exists (
    select 1
    from public.session_participants sp
    where sp.session_id = p_session_id
      and sp.profile_id = v_actor
      and sp.deleted_at is null
  ) then
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.session_participants sp
  where sp.session_id = p_session_id
    and sp.deleted_at is null;

  if v_participant_count >= coalesce(v_session.max_players, 0) then
    raise exception 'Session is full.';
  end if;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto
  )
  values (
    p_session_id,
    v_actor,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_avatar_url, '')), ''),
    nullif(btrim(coalesce(p_avatar_emoji, '')), ''),
    nullif(btrim(coalesce(p_avatar_initials, '')), ''),
    nullif(btrim(coalesce(p_avatar_color, '')), ''),
    nullif(btrim(coalesce(p_avatar_text_color, '')), ''),
    nullif(btrim(coalesce(p_profile_motto, '')), '')
  );

  delete from public.session_waitlist
  where session_id = p_session_id
    and profile_id = v_actor;
end;
$$;


ALTER FUNCTION "private"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."normalize_profile_optional_contact_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;


ALTER FUNCTION "private"."normalize_profile_optional_contact_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."owns_tournament"("target_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_session_id
      and (
        s.owner_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  );
$$;


ALTER FUNCTION "private"."owns_tournament"("target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."player_stat_overrides_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."player_stat_overrides_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."player_zalo_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."player_zalo_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."staff_kiosk_department_is_eligible"("p_department" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select lower(btrim(coalesce(p_department, ''))) in ('vrena', 'manager');
$$;


ALTER FUNCTION "private"."staff_kiosk_department_is_eligible"("p_department" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."staff_kiosk_request_headers"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  v_headers jsonb := '{}'::jsonb;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  return v_headers;
end;
$$;


ALTER FUNCTION "private"."staff_kiosk_request_headers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."staff_kiosk_request_token_hash"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'extensions'
    AS $$
declare
  v_token text := nullif(private.staff_kiosk_request_headers() ->> 'x-vrena-operator-session', '');
begin
  if v_token is null then
    return null;
  end if;
  return encode(extensions.digest(v_token, 'sha256'), 'hex');
end;
$$;


ALTER FUNCTION "private"."staff_kiosk_request_token_hash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."staff_report_profile_is_excluded"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and profile.deleted_at is null
      and regexp_replace(lower(btrim(coalesce(profile.full_name, ''))), '\s+', ' ', 'g') = any (
        array['kiet hao', 'mathieu bernard', 'mathieur bernard', 'harris']::text[]
      )
  );
$$;


ALTER FUNCTION "private"."staff_report_profile_is_excluded"("p_profile_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "private"."staff_report_profile_is_excluded"("p_profile_id" "uuid") IS 'True for the named internal/test profiles excluded from Staff Report non-booking analytics.';



CREATE OR REPLACE FUNCTION "private"."stamp_staff_cost_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
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


ALTER FUNCTION "private"."stamp_staff_cost_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_loyalty_points_delta"("p_profile_id" "uuid", "p_points_delta" integer, "p_rule_id" "uuid" DEFAULT NULL::"uuid", "p_source_type" "text" DEFAULT 'manual_adjustment'::"text", "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("profile_id" "uuid", "loyalty_points_total" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current integer;
  v_next integer;
  v_previous_internal_update text;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_points_delta = 0 then
    return query
    select profiles.id, profiles.loyalty_points_total
    from public.profiles
    where profiles.id = p_profile_id;
    return;
  end if;

  select profiles.loyalty_points_total
  into v_current
  from public.profiles
  where profiles.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if p_source_type = 'staff_order'
    and p_source_id is not null
    and exists (
      select 1
      from public.loyalty_point_transactions as transaction
      where transaction.profile_id = p_profile_id
        and transaction.source_type = p_source_type
        and transaction.source_id = p_source_id
        and transaction.rule_id is not distinct from p_rule_id
    )
  then
    return query select p_profile_id, coalesce(v_current, 0);
    return;
  end if;

  v_next := greatest(0, coalesce(v_current, 0) + p_points_delta);

  v_previous_internal_update := current_setting('app.loyalty_internal_update', true);
  perform set_config('app.loyalty_internal_update', 'allowed', true);

  update public.profiles
  set loyalty_points_total = v_next,
      updated_at = now()
  where id = p_profile_id;

  perform set_config(
    'app.loyalty_internal_update',
    coalesce(v_previous_internal_update, ''),
    true
  );

  insert into public.loyalty_point_transactions (
    profile_id,
    rule_id,
    points_delta,
    balance_after,
    source_type,
    source_id,
    reason,
    created_by
  )
  values (
    p_profile_id,
    p_rule_id,
    p_points_delta,
    v_next,
    p_source_type,
    p_source_id,
    p_reason,
    p_created_by
  )
  on conflict do nothing;

  return query select p_profile_id, v_next;
end;
$$;


ALTER FUNCTION "public"."apply_loyalty_points_delta"("p_profile_id" "uuid", "p_points_delta" integer, "p_rule_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_reason" "text", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_staff_probation_bonus_percentage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_employee public.staff_employee_profiles%rowtype;
  v_period_end date;
  v_percentage numeric := 100;
  v_adjustment_bonus bigint := 0;
  v_recurring_bonus bigint := 0;
  v_original_bonus bigint := 0;
  v_adjusted_bonus bigint := 0;
  v_already_applied boolean := false;
begin
  select run.period_end
  into v_period_end
  from public.staff_payroll_runs run
  where run.id = new.payroll_run_id;

  select *
  into v_employee
  from public.staff_employee_profiles employee
  where employee.profile_id = new.profile_id;

  v_already_applied := coalesce((new.payslip_snapshot ->> 'probationBonusApplied')::boolean, false);
  v_adjustment_bonus := greatest(0, coalesce(new.bonuses_vnd, 0));
  v_recurring_bonus := greatest(0, coalesce(v_employee.monthly_bonus_vnd, 0));
  v_original_bonus := v_adjustment_bonus + v_recurring_bonus;

  if v_period_end is not null
    and v_employee.probation_start_date is not null
    and v_period_end >= v_employee.probation_start_date
    and (v_employee.probation_end_date is null or v_period_end <= v_employee.probation_end_date)
    and (v_employee.labor_start_date is null or v_period_end < v_employee.labor_start_date)
  then
    v_percentage := case when v_employee.probation_bonus_percentage = 85 then 85 else 100 end;
  end if;

  if v_already_applied then
    v_adjusted_bonus := v_adjustment_bonus;
  else
    v_adjusted_bonus := round(v_original_bonus * v_percentage / 100.0);
    new.bonuses_vnd := v_adjusted_bonus;
    new.gross_income_vnd := greatest(0, coalesce(new.gross_income_vnd, 0) - v_adjustment_bonus + v_adjusted_bonus);
  end if;

  new.payslip_snapshot := coalesce(new.payslip_snapshot, '{}'::jsonb) || jsonb_build_object(
    'recurringMonthlyBonusVnd', v_recurring_bonus,
    'probationBonusPercentage', v_percentage,
    'probationBonusApplied', true
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."apply_staff_probation_bonus_percentage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attribute_staff_kiosk_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_auth_user uuid := (select auth.uid());
  v_operator uuid := private.current_staff_kiosk_operator_profile_id();
  v_session uuid := private.current_staff_kiosk_session_id();
  v_role text := private.current_staff_kiosk_role_key();
begin
  new.auth_user_id := coalesce(new.auth_user_id, v_auth_user);
  new.actor_user_id := coalesce(v_auth_user, new.actor_user_id);

  if v_operator is not null and v_session is not null then
    new.operator_session_id := v_session;
    new.operator_role := v_role;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."attribute_staff_kiosk_audit"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."attribute_staff_kiosk_audit"() IS 'Keeps profile foreign keys tied to the authenticated account and attributes a shared-login employee through the kiosk session.';



CREATE OR REPLACE FUNCTION "public"."award_staff_order_loyalty"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_order public.staff_orders%rowtype;
  v_rule record;
  v_points integer;
begin
  select *
  into v_order
  from public.staff_orders
  where id = p_order_id
  for update;

  if not found
    or v_order.customer_id is null
    or v_order.session_id is null
    or v_order.payment_status <> 'paid'
    or v_order.order_status in ('cancelled', 'refunded', 'no_show')
    or not public.profile_has_account(v_order.customer_id)
  then
    return;
  end if;

  for v_rule in
    select *
    from public.staff_loyalty_rules
    where active = true
      and earn_trigger = 'session_payment_confirmed'
      and valid_from <= v_order.booking_date
      and (valid_until is null or valid_until >= v_order.booking_date)
      and (game_id is null or game_id = v_order.game_id)
      and coalesce(v_order.total, 0) >= min_order_total
  loop
    v_points := case v_rule.calculation_type
      when 'per_vnd_spent' then floor((coalesce(v_order.total, 0)::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(greatest(coalesce(v_order.players_count, 0), 0)::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end;

    if v_points > 0 then
      perform public.apply_loyalty_points_delta(
        v_order.customer_id,
        v_points,
        v_rule.id,
        'staff_order',
        v_order.id,
        'Session payment confirmed',
        null
      );
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."award_staff_order_loyalty"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_insert_club_member_row(p_club_id, p_member_profile_id, p_status) $$;


ALTER FUNCTION "public"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_join_session_row"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_join_session_row(p_session_id) $$;


ALTER FUNCTION "public"."can_join_session_row"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_avatar_object_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_avatar_object_path(p_object_name) $$;


ALTER FUNCTION "public"."can_manage_avatar_object_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_club_banner_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_club_banner_path(p_object_name) $$;


ALTER FUNCTION "public"."can_manage_club_banner_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text" DEFAULT 'member'::"text") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_club_member(p_club_id, p_target_profile_id, p_target_role) $$;


ALTER FUNCTION "public"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_club_settings"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_club_settings(p_club_id) $$;


ALTER FUNCTION "public"."can_manage_club_settings"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_session_row"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_session_row(p_session_id) $$;


ALTER FUNCTION "public"."can_manage_session_row"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_staff_game_image_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_staff_game_image_path(p_object_name) $$;


ALTER FUNCTION "public"."can_manage_staff_game_image_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_staff_hr_document_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_staff_hr_document_path(p_object_name) $$;


ALTER FUNCTION "public"."can_manage_staff_hr_document_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_tournament"("target_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_manage_tournament(target_session_id) $$;


ALTER FUNCTION "public"."can_manage_tournament"("target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_read_club_member_row(p_club_id, p_member_profile_id) $$;


ALTER FUNCTION "public"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_staff_attendance_row"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
    or p_profile_id = public.current_staff_actor_profile_id()
$$;


ALTER FUNCTION "public"."can_read_staff_attendance_row"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_staff_attendance_settings"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_read_staff_attendance_settings() $$;


ALTER FUNCTION "public"."can_read_staff_attendance_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_staff_hr_document_path"("p_object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_read_staff_hr_document_path(p_object_name) $$;


ALTER FUNCTION "public"."can_read_staff_hr_document_path"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_use_club_messages"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_use_club_messages(p_club_id) $$;


ALTER FUNCTION "public"."can_use_club_messages"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_club_private_content"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_vrena_admin()
    or exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and (
          clubs.visibility = 'public'
          or clubs.owner_id = auth.uid()
        )
    )
    or exists (
      select 1
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = auth.uid()
        and club_members.status = 'approved'
    );
$$;


ALTER FUNCTION "public"."can_view_club_private_content"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_session_row"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.can_view_session_row(p_session_id) $$;


ALTER FUNCTION "public"."can_view_session_row"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_staff_hr_policy_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
begin
  new.employee_contribution_rate := new.employee_social_insurance_rate
    + new.employee_health_insurance_rate
    + new.employee_unemployment_insurance_rate;
  new.employer_contribution_rate := new.employer_social_insurance_rate
    + new.employer_health_insurance_rate
    + new.employer_unemployment_insurance_rate
    + new.employer_trade_union_rate;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();

  insert into public.staff_hr_policy_versions (
    policy_version, effective_from, policy_status, settings,
    legal_source_url, legal_reviewed_on, created_by, updated_at
  ) values (
    new.policy_version,
    new.effective_from,
    new.policy_status,
    to_jsonb(new) - 'updated_by' - 'updated_at' - 'last_auto_payroll_sync_on',
    new.legal_source_url,
    new.legal_reviewed_on,
    new.updated_by,
    now()
  )
  on conflict (policy_version, effective_from) do update
  set
    policy_status = excluded.policy_status,
    settings = excluded.settings,
    legal_source_url = excluded.legal_source_url,
    legal_reviewed_on = excluded.legal_reviewed_on,
    updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."capture_staff_hr_policy_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
  then
    raise exception 'A permanent account is required.';
  end if;

  if char_length(coalesce(p_guest_phone, '')) > 64
    or char_length(coalesce(p_ticket_reference, '')) > 64
  then
    raise exception 'Invalid booking claim.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt', 10, 600, 'guest-claim:actor-global'
  );
  perform public.consume_rate_limit(
    'booking_attempt',
    3,
    600,
    'guest-claim:' || lower(btrim(coalesce(p_guest_phone, ''))) || ':'
      || upper(btrim(coalesce(p_ticket_reference, '')))
  );

  return private.claim_guest_ticket_booking(p_guest_phone, p_ticket_reference);
end;
$$;


ALTER FUNCTION "public"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_ticket_automatic_discount"("p_discount_rule_id" "uuid", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text" DEFAULT NULL::"text", "p_player_count" integer DEFAULT NULL::integer, "p_start_time" time without time zone DEFAULT NULL::time without time zone, "p_ticket_type" "text" DEFAULT NULL::"text", "p_customer_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("discount_rule_id" "uuid", "discount_name" "text", "discount_amount" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_discount public.staff_discount_rules%rowtype;
  v_discount_amount integer := 0;
  v_requested_price_rule_id uuid;
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
begin
  if p_discount_rule_id is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

  select *
  into v_discount
  from public.staff_discount_rules
  where id = p_discount_rule_id
    and code is null
    and active = true
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (max_uses is null or used_count < max_uses)
    and public.staff_discount_rule_matches_context(
      game_id,
      price_rule_id,
      min_players,
      max_players,
      day_scope,
      time_start,
      time_end,
      ticket_type,
      min_order_total,
      per_customer_limit,
      id,
      p_game_id,
      v_requested_price_rule_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      p_customer_id
    )
  for update;

  if not found then
    return;
  end if;

  v_discount_amount := public.staff_discount_rule_amount(
    v_discount.discount_type,
    v_discount.value,
    v_subtotal,
    p_unit_price,
    v_discount.max_discount_amount
  );

  if v_discount_amount <= 0 then
    return;
  end if;

  update public.staff_discount_rules
  set used_count = used_count + 1
  where id = v_discount.id;

  return query
  select v_discount.id, v_discount.name, v_discount_amount;
end;
$$;


ALTER FUNCTION "public"."claim_ticket_automatic_discount"("p_discount_rule_id" "uuid", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text", "p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_member_role"("p_club_id" "uuid", "p_profile_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_is_internal boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_is_admin boolean := public.is_vrena_admin();
  v_role text := '';
begin
  if p_club_id is null or p_profile_id is null then
    return '';
  end if;

  if not v_actor_is_internal
    and not v_actor_is_admin
    and (v_actor is null or v_actor <> p_profile_id)
  then
    return '';
  end if;

  select case
    when exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = p_profile_id
    ) then 'owner'
    else coalesce((
      select club_members.role
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = p_profile_id
        and club_members.status = 'approved'
        and club_members.deleted_at is null
      limit 1
    ), '')
  end
  into v_role;

  return coalesce(v_role, '');
end;
$$;


ALTER FUNCTION "public"."club_member_role"("p_club_id" "uuid", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clubs_list_page"() RETURNS TABLE("id" "uuid", "owner_id" "uuid", "name" "text", "motto" "text", "description" "text", "banner_url" "text", "theme_color" "text", "default_language" "text", "ranking_criterion" "text", "visibility" "text", "pin_code" "text", "member_count" integer, "created_at" timestamp with time zone, "club_members" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with listable_clubs as (
    select
      c.id,
      c.owner_id,
      c.name::text as name,
      c.motto::text as motto,
      c.description::text as description,
      c.banner_url::text as banner_url,
      c.theme_color::text as theme_color,
      c.default_language::text as default_language,
      c.ranking_criterion::text as ranking_criterion,
      c.visibility::text as visibility,
      c.pin_code::text as pin_code,
      c.member_count::integer as member_count,
      c.created_at,
      (
        public.is_vrena_admin()
        or c.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.club_members manager_membership
          where manager_membership.club_id = c.id
            and manager_membership.profile_id = (select auth.uid())
            and manager_membership.status = 'approved'
            and manager_membership.role = 'admin'
            and manager_membership.deleted_at is null
        )
      ) as can_view_pin_code,
      (
        public.is_vrena_admin()
        or c.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.club_members manager_membership
          where manager_membership.club_id = c.id
            and manager_membership.profile_id = (select auth.uid())
            and manager_membership.status = 'approved'
            and manager_membership.role in ('admin', 'moderator')
            and manager_membership.deleted_at is null
        )
      ) as can_manage_members,
      (
        c.visibility = 'public'
        or (
          (select auth.uid()) is not null
          and (
            public.is_vrena_admin()
            or c.owner_id = (select auth.uid())
            or exists (
              select 1
              from public.club_members own_approved_membership
              where own_approved_membership.club_id = c.id
                and own_approved_membership.profile_id = (select auth.uid())
                and own_approved_membership.status = 'approved'
                and own_approved_membership.deleted_at is null
            )
          )
        )
      ) as can_view_members
    from public.clubs c
  )
  select
    listable_clubs.id,
    listable_clubs.owner_id,
    listable_clubs.name,
    listable_clubs.motto,
    listable_clubs.description,
    listable_clubs.banner_url,
    listable_clubs.theme_color,
    listable_clubs.default_language,
    listable_clubs.ranking_criterion,
    listable_clubs.visibility,
    case when listable_clubs.can_view_pin_code then listable_clubs.pin_code else null end as pin_code,
    listable_clubs.member_count,
    listable_clubs.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'club_id', cm.club_id,
          'profile_id', cm.profile_id,
          'display_name', cm.display_name,
          'avatar_url', cm.avatar_url,
          'avatar_emoji', cm.avatar_emoji,
          'avatar_initials', cm.avatar_initials,
          'avatar_color', cm.avatar_color,
          'avatar_text_color', cm.avatar_text_color,
          'profile_motto', cm.profile_motto,
          'status', cm.status,
          'deleted_at', cm.deleted_at,
          'role', cm.role,
          'created_at', cm.created_at
        )
        order by
          case when cm.status = 'approved' then 0 else 1 end,
          cm.created_at nulls last,
          cm.display_name nulls last
      )
      from public.club_members cm
      where cm.club_id = listable_clubs.id
        and cm.deleted_at is null
        and (
          (cm.status = 'approved' and listable_clubs.can_view_members)
          or cm.profile_id = (select auth.uid())
          or listable_clubs.can_manage_members
        )
    ), '[]'::jsonb) as club_members
  from listable_clubs
  order by listable_clubs.created_at desc nulls last, listable_clubs.name asc;
$$;


ALTER FUNCTION "public"."clubs_list_page"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_booking_attempt_rate_limit"("p_subject" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
begin
  if length(coalesce(v_subject, '')) > 180 then
    raise exception 'Rate limit subject is too long.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt',
    20,
    60,
    '__booking_global__'
  );

  return public.consume_rate_limit(
    'booking_attempt',
    3,
    60,
    coalesce(v_subject, '__default__')
  );
end;
$$;


ALTER FUNCTION "public"."consume_booking_attempt_rate_limit"("p_subject" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_guest_ticket_booking_rate_limit"("p_guest_phone" "text", "p_date" "date", "p_start_time" time without time zone, "p_ticket_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_results jsonb := '[]'::jsonb;
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null then
    raise exception 'Enter a valid phone number.';
  end if;

  v_results := v_results || jsonb_build_array(public.consume_rate_limit(
    'booking_attempt',
    3,
    10 * 60,
    'guest-ticket-phone:' || v_guest_phone
  ));

  v_results := v_results || jsonb_build_array(public.consume_rate_limit(
    'booking_attempt',
    6,
    60,
    'guest-ticket-slot:' ||
      coalesce(p_date::text, 'unknown-date') || ':' ||
      coalesce(p_start_time::text, 'unknown-time') || ':' ||
      lower(coalesce(nullif(btrim(p_ticket_type), ''), 'unknown-type'))
  ));

  return jsonb_build_object('allowed', true, 'checks', v_results);
end;
$$;


ALTER FUNCTION "public"."consume_guest_ticket_booking_rate_limit"("p_guest_phone" "text", "p_date" "date", "p_start_time" time without time zone, "p_ticket_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_login_attempt_rate_limit"("p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
begin
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email.';
  end if;

  return public.consume_rate_limit(
    'login_attempt',
    5,
    10 * 60,
    'email:' || v_email
  );
end;
$_$;


ALTER FUNCTION "public"."consume_login_attempt_rate_limit"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_password_reset_rate_limit"("p_email" "text", "p_ip" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_ip text := lower(coalesce(nullif(btrim(coalesce(p_ip, '')), ''), 'unknown'));
  v_result jsonb;
begin
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email.';
  end if;

  perform public.consume_rate_limit(
    'password_reset_ip',
    10,
    10 * 60,
    'ip:' || v_ip
  );

  v_result := public.consume_rate_limit(
    'password_reset',
    3,
    10 * 60,
    'email:' || v_email
  );

  return v_result;
end;
$_$;


ALTER FUNCTION "public"."consume_password_reset_rate_limit"("p_email" "text", "p_ip" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$
  select private.consume_rate_limit(p_action, p_limit, p_window_seconds, p_subject)
$$;


ALTER FUNCTION "public"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_user_action_rate_limit"("p_action" "text", "p_subject" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_limit integer;
  v_window_seconds integer;
  v_global_limit integer;
begin
  if v_actor is null or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Login required.';
  end if;

  if length(coalesce(v_subject, '')) > 180 then
    raise exception 'Rate limit subject is too long.';
  end if;

  case p_action
    when 'join_leave' then
      v_limit := 5;
      v_window_seconds := 60;
      v_global_limit := 30;
    when 'admin_destructive' then
      v_limit := 3;
      v_window_seconds := 60;
      v_global_limit := 12;
    when 'staff_config_write' then
      if coalesce(public.current_staff_role_rank(), 0) < 50 then
        raise exception 'Staff access required.';
      end if;
      v_limit := 20;
      v_window_seconds := 10 * 60;
      v_global_limit := 60;
    else
      raise exception 'Unknown rate limit action.';
  end case;

  perform public.consume_rate_limit(
    p_action,
    v_global_limit,
    v_window_seconds,
    '__actor_global__'
  );

  return public.consume_rate_limit(
    p_action,
    v_limit,
    v_window_seconds,
    coalesce(v_subject, '__default__')
  );
end;
$$;


ALTER FUNCTION "public"."consume_user_action_rate_limit"("p_action" "text", "p_subject" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text" DEFAULT NULL::"text", "p_guest_name" "text" DEFAULT NULL::"text", "p_special_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_customer public.profiles%rowtype;
  v_customer_id uuid;
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_special_note text := left(nullif(btrim(coalesce(p_special_note, '')), ''), 500);
  v_session_id uuid;
  v_ticket_reference text;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_duration_blocks integer;
  v_discount_rate numeric := 0;
  v_expected_unit_price integer;
  v_expected_total integer;
  v_game_options text[] := coalesce(nullif(p_game_options, array[]::text[]), array['laser-tag']);
begin

  perform private.guard_duplicate_ticket_booking(
    'cafe-des-stagiaires', auth.uid(), p_guest_phone,
    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count
  );
  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_date < date '2026-08-31' then
    raise exception 'VRena Café des Stagiaires bookings open on August 31.';
  end if;

  if p_player_count < 1
    or (p_ticket_type = 'corporate' and p_player_count > 32)
    or (p_ticket_type <> 'corporate' and p_player_count > 16)
  then
    raise exception 'Invalid player count.';
  end if;

  if p_ticket_type = 'birthday' and p_player_count < 4 then
    raise exception 'Birthday bookings need at least 4 players.';
  end if;

  if p_ticket_type = 'corporate' and p_player_count < 6 then
    raise exception 'Corporate bookings need at least 6 players.';
  end if;

  if p_arena_count is distinct from 1 then
    raise exception 'Cafe bookings use one arena.';
  end if;

  if p_arena_count = 2 and p_player_count <= 4 then
    raise exception 'Two arenas require at least five players.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < public.ticket_minimum_duration_minutes('cafe-des-stagiaires', p_date, p_player_count, p_arena_count) then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60
    + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 16 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside VRena Café des Stagiaires opening hours.';
  end if;

  if public.ticket_booking_start_is_past(p_date, p_start_time) then
    raise exception 'Selected time is already past.';
  end if;

  if v_user_id is null then
    v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

    if nullif(v_guest_phone, '') is null
      or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15
    then
      raise exception 'Enter a valid phone number.';
    end if;

    perform public.consume_guest_ticket_booking_rate_limit(
      v_guest_phone,
      p_date,
      p_start_time,
      p_ticket_type
    );

    select *
    into v_customer
    from public.ensure_guest_ticket_profile(v_guest_phone, v_guest_name);
  else
    select *
    into v_customer
    from public.profiles
    where id = v_user_id
      and deleted_at is null;

    if not found then
      raise exception 'Profile required to request tickets.';
    end if;
  end if;

  v_customer_id := v_customer.id;
  v_expected_unit_price := public.ticket_tariff_unit_price(
    'cafe-des-stagiaires',
    p_ticket_type,
    p_date,
    p_start_time
  );
  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))::integer);

  if p_ticket_type = 'individual' then
    if p_player_count > 8 then
      v_discount_rate := 0.15;
    elsif p_player_count > 4 then
      v_discount_rate := 0.10;
    end if;

    v_expected_total := round(
      (v_expected_unit_price * v_duration_blocks * p_player_count)::numeric * (1 - v_discount_rate)
    )::integer;
  else
    v_expected_total := 0;
  end if;

  v_ticket_reference := 'CS-' || to_char(now(), 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  perform set_config('app.cafe_booking_request', '1', true);

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id,
    venue_key
  ) values (
    v_customer_id,
    null,
    'game',
    'Cafe soft-opening request - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    p_arena_count,
    v_game_options,
    '{}'::jsonb,
    null,
    'private',
    v_invite_code,
    concat_ws(E'\n', 'Zalo confirmation required for VRena Café des Stagiaires soft opening.', v_special_note),
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'ticket',
    p_ticket_type,
    p_player_count,
    v_expected_unit_price,
    v_expected_total,
    'pending',
    v_ticket_reference,
    v_customer_id,
    'cafe-des-stagiaires'
  )
  returning id into v_session_id;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    payment_amount
  ) values (
    v_session_id,
    v_customer_id,
    coalesce(v_guest_name, v_customer.nickname, v_customer.full_name, v_customer.phone, 'Guest'),
    v_customer.avatar_url,
    v_customer.avatar_emoji,
    v_customer.avatar_initials,
    v_customer.avatar_color,
    v_customer.avatar_text_color,
    v_customer.profile_motto,
    v_expected_total
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'pending',
    'ticket_unit_price', v_expected_unit_price,
    'ticket_total_price', v_expected_total,
    'venue_key', 'cafe-des-stagiaires',
    'guest_phone', case when v_user_id is null then v_guest_phone else null end,
    'guest_name', coalesce(v_guest_name, v_customer.full_name, v_customer.nickname)
  );
end;
$$;


ALTER FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text", "p_guest_name" "text", "p_special_note" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text", "p_guest_name" "text", "p_special_note" "text") IS 'Creates a pending VRena Café des Stagiaires soft-opening ticket request that requires Zalo confirmation.';



CREATE OR REPLACE FUNCTION "public"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if auth.uid() is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
  then
    raise exception 'A permanent account is required.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt', 10, 600, 'friend-challenge:actor-global'
  );
  perform public.consume_rate_limit(
    'booking_attempt',
    3,
    3600,
    'friend-challenge:target:' || coalesce(p_target_profile_id::text, 'missing')
  );

  return private.create_friend_challenge(
    p_target_profile_id,
    p_date,
    p_start_time,
    p_duration_minutes,
    p_game_id
  );
end;
$$;


ALTER FUNCTION "public"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_guest_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_guest_phone" "text", "p_guest_name" "text" DEFAULT NULL::"text", "p_guest_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_customer_id uuid;
  v_customer public.profiles%rowtype;
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_guest_note text := left(nullif(btrim(coalesce(p_guest_note, '')), ''), 500);
  v_session_id uuid;
  v_ticket_reference text;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_game_options text[] := coalesce(nullif(p_game_options, array[]::text[]), array['laser-tag']);
  v_default_game text;
  v_staff_game_id uuid;
  v_discount_rate numeric := 0;
  v_duration_blocks integer;
  v_charged_players_per_block numeric;
  v_charged_player_spots numeric;
  v_expected_unit_price integer;
  v_expected_total integer;
  v_order_id uuid;
  v_order_number text;
begin

  perform private.guard_duplicate_ticket_booking(
    'ha-do-centrosa', null, p_guest_phone,
    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count
  );
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  perform public.consume_guest_ticket_booking_rate_limit(
    v_guest_phone,
    p_date,
    p_start_time,
    p_ticket_type
  );

  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_ticket_type = 'individual' then
    v_guest_note := null;
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_player_count < 1
    or (p_ticket_type = 'corporate' and p_player_count > 32)
    or (p_ticket_type <> 'corporate' and p_player_count > 16)
  then
    raise exception 'Invalid player count.';
  end if;

  if p_ticket_type = 'birthday' and p_player_count < 4 then
    raise exception 'Birthday bookings need at least 4 players.';
  end if;

  if p_ticket_type = 'corporate' and p_player_count < 6 then
    raise exception 'Corporate bookings need at least 6 players.';
  end if;

  if p_arena_count < 1 or p_arena_count > 2 then
    raise exception 'Ticket bookings can reserve one or two arenas.';
  end if;

  if p_arena_count = 2 and p_player_count <= 4 then
    raise exception 'Two arenas require at least five players.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < public.ticket_minimum_duration_minutes('ha-do-centrosa', p_date, p_player_count, p_arena_count) then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if public.ticket_booking_start_is_past(p_date, p_start_time) then
    raise exception 'Selected time is already past.';
  end if;

  v_expected_unit_price := public.ticket_tariff_unit_price(
    'ha-do-centrosa',
    p_ticket_type,
    p_date,
    p_start_time
  );

  if p_unit_price <> v_expected_unit_price then
    raise exception 'Ticket unit price does not match the selected tariff.';
  end if;

  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))::integer);
  v_charged_players_per_block := p_player_count;
  v_charged_player_spots := v_duration_blocks * v_charged_players_per_block;

  if p_ticket_type = 'individual' then
    if p_player_count > 8 then
      v_discount_rate := 0.15;
    elsif p_player_count > 4 then
      v_discount_rate := 0.10;
    end if;

    v_expected_total := round((v_expected_unit_price * v_charged_player_spots)::numeric * (1 - v_discount_rate))::integer;
  else
    v_expected_total := 0;
  end if;

  if p_total_price <> v_expected_total then
    raise exception 'Ticket price does not match the reserved capacity.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where venue_key = 'ha-do-centrosa'
      and date = p_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_start_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where date = p_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_start_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < p_arena_count then
    raise exception 'Selected time slot does not have enough arenas available.';
  end if;

  select *
  into v_customer
  from public.ensure_guest_ticket_profile(v_guest_phone, v_guest_name);

  v_customer_id := v_customer.id;

  v_default_game := coalesce(v_game_options[1], 'laser-tag');

  select id
  into v_staff_game_id
  from public.staff_games
  where lower(slug) = lower(v_default_game)
  limit 1;

  v_ticket_reference := 'TKT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  ) values (
    v_customer_id,
    null,
    'game',
    'Ticket booking - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    p_arena_count,
    array[]::text[],
    '{}'::jsonb,
    null,
    'private',
    v_invite_code,
    coalesce(v_guest_note, 'Guest ticket booking'),
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'ticket',
    p_ticket_type,
    p_player_count,
    v_expected_unit_price,
    v_expected_total,
    'confirmed',
    v_ticket_reference,
    v_customer_id
  )
  returning id into v_session_id;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    payment_amount
  ) values (
    v_session_id,
    v_customer_id,
    coalesce(nullif(v_guest_name, ''), v_customer.nickname, v_customer.full_name, v_customer.phone, 'Guest'),
    v_customer.avatar_url,
    v_customer.avatar_emoji,
    v_customer.avatar_initials,
    v_customer.avatar_color,
    v_customer.avatar_text_color,
    v_customer.profile_motto,
    v_expected_total
  );

  insert into public.staff_orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    game_id,
    session_id,
    booking_date,
    booking_time,
    players_count,
    arena_id,
    subtotal,
    discount_rule_id,
    discount_code,
    discount_total,
    total,
    payment_method,
    payment_status,
    order_status,
    created_by,
    invoice_required,
    invoice_status,
    internal_note
  ) values (
    v_customer_id,
    coalesce(v_guest_name, v_customer.full_name, v_customer.nickname),
    v_guest_phone,
    v_customer.email,
    v_staff_game_id,
    v_session_id,
    p_date,
    p_start_time,
    p_player_count,
    'arena-1',
    v_expected_total,
    null,
    null,
    0,
    v_expected_total,
    'unpaid',
    'unpaid',
    'confirmed',
    null,
    false,
    'not_requested',
    'Guest ticket booking. Reference: ' || v_ticket_reference
  )
  returning id, order_number into v_order_id, v_order_number;

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'confirmed',
    'guest_phone', v_guest_phone,
    'guest_name', coalesce(v_guest_name, v_customer.full_name, v_customer.nickname),
    'order_id', v_order_id,
    'order_number', v_order_number
  );
end;
$$;


ALTER FUNCTION "public"."create_guest_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_guest_phone" "text", "p_guest_name" "text", "p_guest_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_staff_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_payment_method" "text", "p_payment_status" "text", "p_order_status" "text", "p_invoice_required" boolean DEFAULT false, "p_company_name" "text" DEFAULT NULL::"text", "p_tax_code" "text" DEFAULT NULL::"text", "p_invoice_email" "text" DEFAULT NULL::"text", "p_invoice_address" "text" DEFAULT NULL::"text", "p_internal_note" "text" DEFAULT NULL::"text", "p_manual_discount_type" "text" DEFAULT NULL::"text", "p_manual_discount_value" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_staff_id uuid := (select auth.uid());
  v_game public.staff_games%rowtype;
  v_rule public.staff_pricing_rules%rowtype;
  v_discount public.staff_discount_rules%rowtype;
  v_customer public.profiles%rowtype;
  v_booking_minutes integer;
  v_end_minutes integer;
  v_duration_blocks integer;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_total integer := 0;
  v_discount_code text := null;
  v_session_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_game_slug text;
  v_invite_code text;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_display_name text;
  v_manual_discount_type text := nullif(btrim(coalesce(p_manual_discount_type, '')), '');
  v_manual_discount_value numeric := greatest(0, coalesce(p_manual_discount_value, 0));
begin
  if v_staff_id is null or not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_game_id is null or p_booking_date is null or p_booking_time is null then
    raise exception 'Game, date, and time are required.';
  end if;

  if p_players_count is null or p_players_count < 1 or p_players_count > 64 then
    raise exception 'Invalid player count.';
  end if;

  if p_payment_method not in ('cash', 'bank_transfer', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid') then
    raise exception 'Invalid payment method.';
  end if;

  if p_payment_status not in ('unpaid', 'partially_paid', 'paid', 'refunded') then
    raise exception 'Invalid payment status.';
  end if;

  if p_order_status not in ('draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed') then
    raise exception 'Invalid order status.';
  end if;

  if p_discount_rule_id is not null and v_manual_discount_type is not null and v_manual_discount_value > 0 then
    raise exception 'Use either a saved voucher or a unique discount, not both.';
  end if;

  if v_manual_discount_type is not null and v_manual_discount_type not in ('fixed_amount', 'percentage') then
    raise exception 'Invalid unique discount type.';
  end if;

  if v_manual_discount_value > 0 and v_manual_discount_type is null then
    raise exception 'Unique discount type is required.';
  end if;

  select *
  into v_game
  from public.staff_games
  where id = p_game_id
    and active = true;

  if not found then
    raise exception 'Active game not found.';
  end if;

  select *
  into v_rule
  from public.staff_pricing_rules
  where active = true
    and (game_id is null or game_id = p_game_id)
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (
      day_type = 'custom'
      or (day_type = 'holiday' and p_booking_date between valid_from and coalesce(valid_until, valid_from))
      or (day_type = 'weekend' and extract(isodow from p_booking_date) in (6, 7))
      or (day_type = 'weekday' and extract(isodow from p_booking_date) between 1 and 5)
    )
    and (time_start is null or p_booking_time >= time_start)
    and (time_end is null or p_booking_time < time_end)
  order by
    case when game_id = p_game_id then 0 else 1 end,
    case when day_type in ('custom', 'holiday') then 0 else 1 end,
    valid_from desc,
    created_at desc
  limit 1;

  if not found then
    v_rule.price_per_player := 200000;
    v_rule.price_per_arena_slot := null;
  end if;

  v_booking_minutes := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_minutes := v_booking_minutes + v_game.duration_minutes;
  v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer);

  if v_booking_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where date = p_booking_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_booking_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where date = p_booking_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_booking_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < 1 then
    raise exception 'Selected time slot is no longer available.';
  end if;

  if v_rule.price_per_arena_slot is not null then
    v_subtotal := v_duration_blocks * v_rule.price_per_arena_slot;
  else
    v_subtotal := greatest(0, coalesce(v_rule.price_per_player, 0)) * p_players_count;
  end if;

  if p_discount_rule_id is not null then
    select *
    into v_discount
    from public.staff_discount_rules
    where id = p_discount_rule_id
      and active = true
      and valid_from <= p_booking_date
      and (valid_until is null or valid_until >= p_booking_date)
      and public.staff_discount_rule_matches_context(
        game_id,
        v_rule.id,
        min_players,
        max_players,
        day_scope,
        time_start,
        time_end,
        ticket_type,
        min_order_total,
        per_customer_limit,
        id,
        p_game_id::text,
        v_rule.id,
        p_booking_date,
        p_booking_time,
        p_players_count,
        v_subtotal,
        'all',
        p_customer_id
      )
    for update;

    if not found then
      raise exception 'Discount is not active.';
    end if;

    if v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses then
      raise exception 'Discount use limit reached.';
    end if;

    v_discount_code := v_discount.code;
    if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
      v_discount_total := round(v_subtotal * least(v_discount.value, 100) / 100)::integer;
    elsif v_discount.discount_type = 'fixed_amount' then
      v_discount_total := v_discount.value::integer;
    elsif v_discount.discount_type = 'free_ticket' then
      v_discount_total := greatest(coalesce(v_rule.price_per_player, 0), 0);
    end if;

    v_discount_total := public.staff_discount_rule_amount(
      v_discount.discount_type,
      v_discount.value,
      v_subtotal,
      coalesce(v_rule.price_per_player, 0),
      v_discount.max_discount_amount
    );

    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_manual_discount_type is not null and v_manual_discount_value > 0 then
    if v_manual_discount_type = 'percentage' then
      v_discount_total := round(v_subtotal * least(v_manual_discount_value, 100) / 100)::integer;
      v_discount_code := 'Manual ' || trim(to_char(least(v_manual_discount_value, 100), 'FM999990.##')) || '%';
    elsif v_manual_discount_type = 'fixed_amount' then
      v_discount_total := round(v_manual_discount_value)::integer;
      v_discount_code := 'Manual ' || round(v_manual_discount_value)::integer::text || ' VND';
    end if;

    v_discount_total := least(v_subtotal, greatest(0, v_discount_total));
  end if;

  v_total := greatest(0, v_subtotal - v_discount_total);
  v_game_slug := coalesce(nullif(v_game.slug, ''), replace(lower(v_game.name), ' ', '-'));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  ) values (
    v_staff_id,
    null,
    'game',
    'Staff booking - ' || v_game.name,
    p_booking_date,
    p_booking_time,
    v_game.duration_minutes,
    p_players_count,
    1,
    array[v_game_slug],
    jsonb_build_object(v_staff_id::text, v_game_slug),
    v_game_slug,
    'private',
    v_invite_code,
    nullif(concat_ws(' · ', 'Staff Console', p_internal_note), ''),
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'ticket',
    'individual',
    p_players_count,
    coalesce(v_rule.price_per_player, 0),
    v_total,
    case when p_order_status in ('cancelled', 'refunded') then 'cancelled' else 'confirmed' end,
    'POS-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    p_customer_id
  )
  returning id into v_session_id;

  if p_customer_id is not null then
    select *
    into v_customer
    from public.profiles
    where id = p_customer_id;

    if found then
      v_display_name := coalesce(v_customer.nickname, v_customer.full_name, v_customer.phone, v_customer.email, 'Customer');
      insert into public.session_participants (
        session_id,
        profile_id,
        display_name,
        avatar_url,
        avatar_emoji,
        avatar_initials,
        avatar_color,
        avatar_text_color,
        profile_motto,
        payment_amount
      ) values (
        v_session_id,
        p_customer_id,
        v_display_name,
        v_customer.avatar_url,
        v_customer.avatar_emoji,
        v_customer.avatar_initials,
        v_customer.avatar_color,
        v_customer.avatar_text_color,
        v_customer.profile_motto,
        v_total
      )
      on conflict do nothing;
    end if;
  end if;

  insert into public.staff_orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    game_id,
    session_id,
    booking_date,
    booking_time,
    players_count,
    arena_id,
    subtotal,
    discount_rule_id,
    discount_code,
    discount_total,
    total,
    payment_method,
    payment_status,
    order_status,
    created_by,
    invoice_required,
    company_name,
    tax_code,
    invoice_email,
    invoice_address,
    invoice_status,
    internal_note
  ) values (
    p_customer_id,
    nullif(btrim(p_customer_name), ''),
    nullif(btrim(p_customer_phone), ''),
    nullif(btrim(p_customer_email), ''),
    p_game_id,
    v_session_id,
    p_booking_date,
    p_booking_time,
    p_players_count,
    nullif(btrim(p_arena_id), ''),
    v_subtotal,
    p_discount_rule_id,
    v_discount_code,
    v_discount_total,
    v_total,
    p_payment_method,
    p_payment_status,
    p_order_status,
    v_staff_id,
    coalesce(p_invoice_required, false),
    nullif(btrim(p_company_name), ''),
    nullif(btrim(p_tax_code), ''),
    nullif(btrim(p_invoice_email), ''),
    nullif(btrim(p_invoice_address), ''),
    case when coalesce(p_invoice_required, false) then 'pending' else 'not_requested' end,
    nullif(btrim(p_internal_note), '')
  )
  returning id, order_number into v_order_id, v_order_number;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'session_id', v_session_id,
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'total', v_total
  );
end;
$$;


ALTER FUNCTION "public"."create_staff_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_payment_method" "text", "p_payment_status" "text", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_staff_order_with_payments"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_order_status" "text", "p_invoice_required" boolean DEFAULT false, "p_company_name" "text" DEFAULT NULL::"text", "p_tax_code" "text" DEFAULT NULL::"text", "p_invoice_email" "text" DEFAULT NULL::"text", "p_invoice_address" "text" DEFAULT NULL::"text", "p_internal_note" "text" DEFAULT NULL::"text", "p_manual_discount_type" "text" DEFAULT NULL::"text", "p_manual_discount_value" numeric DEFAULT 0, "p_payment_splits" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_staff_id uuid := (select auth.uid());
  v_order jsonb;
  v_order_id uuid;
  v_total integer;
  v_split record;
  v_paid_total integer := 0;
  v_split_count integer := 0;
  v_first_method text := null;
  v_summary_method text := 'unpaid';
  v_payment_status text := 'unpaid';
begin
  if v_staff_id is null or not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_payment_splits is null then
    p_payment_splits := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_payment_splits) <> 'array' then
    raise exception 'Payment splits must be an array.';
  end if;

  for v_split in
    select *
    from jsonb_to_recordset(p_payment_splits) as split(payment_method text, amount integer)
  loop
    if v_split.payment_method not in ('cash', 'bank_transfer') then
      raise exception 'Invalid split payment method.';
    end if;

    if v_split.amount is null or v_split.amount <= 0 then
      raise exception 'Split payment amount must be positive.';
    end if;

    v_split_count := v_split_count + 1;
    v_paid_total := v_paid_total + v_split.amount;
    v_first_method := coalesce(v_first_method, v_split.payment_method);
  end loop;

  v_order := public.create_staff_order(
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_game_id,
    p_booking_date,
    p_booking_time,
    p_players_count,
    p_arena_id,
    p_discount_rule_id,
    coalesce(v_first_method, 'unpaid'),
    'unpaid',
    p_order_status,
    p_invoice_required,
    p_company_name,
    p_tax_code,
    p_invoice_email,
    p_invoice_address,
    p_internal_note,
    p_manual_discount_type,
    p_manual_discount_value
  );

  v_order_id := (v_order->>'order_id')::uuid;
  v_total := coalesce((v_order->>'total')::integer, 0);

  insert into public.staff_order_payments (order_id, payment_method, amount, created_by)
  select
    v_order_id,
    split.payment_method,
    split.amount,
    v_staff_id
  from jsonb_to_recordset(p_payment_splits) as split(payment_method text, amount integer);

  if v_total <= 0 then
    v_payment_status := 'paid';
  elsif v_paid_total <= 0 then
    v_payment_status := 'unpaid';
  elsif v_paid_total >= v_total then
    v_payment_status := 'paid';
  else
    v_payment_status := 'partially_paid';
  end if;

  if v_split_count = 1 then
    v_summary_method := coalesce(v_first_method, 'unpaid');
  elsif v_split_count > 1 then
    v_summary_method := 'split';
  end if;

  update public.staff_orders
  set payment_method = v_summary_method,
      payment_status = v_payment_status,
      order_status = case
        when p_order_status in ('paid', 'partially_paid') then v_payment_status
        else p_order_status
      end
  where id = v_order_id;

  return v_order || jsonb_build_object(
    'paid_total', v_paid_total,
    'payment_status', v_payment_status,
    'payment_method', v_summary_method
  );
end;
$$;


ALTER FUNCTION "public"."create_staff_order_with_payments"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric, "p_payment_splits" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_loyalty_points_to_redeem" integer DEFAULT 0, "p_discount_code" "text" DEFAULT NULL::"text", "p_special_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_session_id uuid;
  v_ticket_reference text;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_game_options text[] := coalesce(nullif(p_game_options, array[]::text[]), array['laser-tag']);
  v_default_game text;
  v_discount public.staff_discount_rules%rowtype;
  v_discount_code text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
  v_discount_source text := 'automatic';
  v_special_note text := left(nullif(btrim(coalesce(p_special_note, '')), ''), 500);
  v_auto_discount_rate numeric := 0;
  v_auto_discount integer := 0;
  v_auto_discount_rule_id uuid := null;
  v_duration_blocks integer;
  v_charged_players_per_block numeric;
  v_charged_player_spots numeric;
  v_expected_unit_price integer;
  v_expected_gross integer;
  v_expected_subtotal integer;
  v_expected_total integer;
  v_voucher_discount integer := 0;
  v_applied_discount integer := 0;
  v_applied_discount_code text := null;
  v_loyalty_points_to_redeem integer := greatest(0, coalesce(p_loyalty_points_to_redeem, 0));
  v_redeem_value integer := 0;
  v_loyalty_discount integer := 0;
  v_loyalty_balance_after integer := null;
begin

  perform private.guard_duplicate_ticket_booking(
    'ha-do-centrosa', auth.uid(), null,
    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count
  );
  if v_user_id is null then
    raise exception 'Login required to book tickets.';
  end if;

  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_ticket_type = 'individual' then
    v_special_note := null;
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_player_count < 1
    or (p_ticket_type = 'corporate' and p_player_count > 32)
    or (p_ticket_type <> 'corporate' and p_player_count > 16)
  then
    raise exception 'Invalid player count.';
  end if;

  if p_ticket_type = 'birthday' and p_player_count < 4 then
    raise exception 'Birthday bookings need at least 4 players.';
  end if;

  if p_ticket_type = 'corporate' and p_player_count < 6 then
    raise exception 'Corporate bookings need at least 6 players.';
  end if;

  if p_arena_count < 1 or p_arena_count > 2 then
    raise exception 'Ticket bookings can reserve one or two arenas.';
  end if;

  if p_arena_count = 2 and p_player_count <= 4 then
    raise exception 'Two arenas require at least five players.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < public.ticket_minimum_duration_minutes('ha-do-centrosa', p_date, p_player_count, p_arena_count) then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if public.ticket_booking_start_is_past(p_date, p_start_time) then
    raise exception 'Selected time is already past.';
  end if;

  if p_ticket_type <> 'individual' then
    v_discount_code := null;
    v_loyalty_points_to_redeem := 0;
  end if;

  v_expected_unit_price := public.ticket_tariff_unit_price(
    'ha-do-centrosa',
    p_ticket_type,
    p_date,
    p_start_time
  );

  if p_ticket_type <> 'individual' then
    v_expected_unit_price := 0;
  end if;

  if p_unit_price <> v_expected_unit_price then
    raise exception 'Ticket unit price does not match the selected tariff.';
  end if;

  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))::integer);
  v_charged_players_per_block := p_player_count;
  v_charged_player_spots := v_duration_blocks * v_charged_players_per_block;
  v_expected_gross := v_expected_unit_price * v_charged_player_spots;

  select quote.discount_rule_id, quote.discount_amount
  into v_auto_discount_rule_id, v_auto_discount
  from public.ticket_automatic_discount_quote(
    p_date,
    v_expected_gross,
    v_expected_unit_price,
    coalesce(v_game_options[1], 'laser-tag'),
    p_player_count,
    p_start_time,
    p_ticket_type
  ) as quote
  limit 1;

  v_auto_discount := coalesce(v_auto_discount, 0);

  if v_discount_code is not null then
    select *
    into v_discount
    from public.staff_discount_rules
    where code is not null
      and lower(btrim(code)) = lower(v_discount_code)
      and active = true
      and valid_from <= p_date
      and (valid_until is null or valid_until >= p_date)
      and public.staff_discount_rule_matches_context(
        game_id,
        public.staff_ticket_price_rule_id(coalesce(v_game_options[1], 'laser-tag'), p_date, p_start_time),
        min_players,
        max_players,
        day_scope,
        time_start,
        time_end,
        ticket_type,
        min_order_total,
        per_customer_limit,
        id,
        coalesce(v_game_options[1], 'laser-tag'),
        public.staff_ticket_price_rule_id(coalesce(v_game_options[1], 'laser-tag'), p_date, p_start_time),
        p_date,
        p_start_time,
        p_player_count,
        v_expected_gross,
        p_ticket_type,
        v_user_id
      )
    for update;

    if not found then
      raise exception 'Discount code is not valid for this booking.';
    end if;

    if v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses then
      raise exception 'Discount code use limit reached.';
    end if;

    if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
      v_voucher_discount := round(v_expected_gross * least(v_discount.value, 100) / 100)::integer;
    elsif v_discount.discount_type = 'fixed_amount' then
      v_voucher_discount := v_discount.value::integer;
    elsif v_discount.discount_type = 'free_ticket' then
      v_voucher_discount := v_expected_unit_price;
    end if;

    v_voucher_discount := public.staff_discount_rule_amount(
      v_discount.discount_type,
      v_discount.value,
      v_expected_gross,
      v_expected_unit_price,
      v_discount.max_discount_amount
    );

  end if;

  if v_voucher_discount > v_auto_discount then
    v_applied_discount := v_voucher_discount;
    v_applied_discount_code := v_discount.code;
    v_discount_source := 'voucher';
  else
    v_applied_discount := v_auto_discount;
  end if;

  v_expected_subtotal := greatest(0, v_expected_gross - v_applied_discount);

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile required to book tickets.';
  end if;

  if v_loyalty_points_to_redeem > 0 then
    select coalesce(max(r.redeem_value_vnd_per_point), 0)
    into v_redeem_value
    from public.staff_loyalty_rules r
    where r.active = true
      and r.redeem_value_vnd_per_point > 0
      and r.valid_from <= p_date
      and (r.valid_until is null or r.valid_until >= p_date)
      and public.staff_loyalty_rule_matches_game(r.game_id, coalesce(v_game_options[1], 'laser-tag'));

    if coalesce(v_redeem_value, 0) <= 0 then
      raise exception 'Loyalty redemption is not available for this booking.';
    end if;

    if v_loyalty_points_to_redeem > coalesce(v_profile.loyalty_points_total, 0) then
      raise exception 'Not enough loyalty points.';
    end if;

    if (v_loyalty_points_to_redeem * v_redeem_value) > v_expected_subtotal then
      raise exception 'Too many loyalty points for this ticket total.';
    end if;

    v_loyalty_discount := v_loyalty_points_to_redeem * v_redeem_value;
  end if;

  v_expected_total := greatest(0, v_expected_subtotal - v_loyalty_discount);

  if p_total_price <> v_expected_total then
    raise exception 'Ticket price does not match the reserved capacity, discount, and loyalty redemption.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where venue_key = 'ha-do-centrosa'
      and date = p_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_start_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where date = p_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_start_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < p_arena_count then
    raise exception 'Selected time slot does not have enough arenas available.';
  end if;

  if v_discount_source = 'voucher' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_auto_discount_rule_id is not null and v_auto_discount > 0 then
    select claim.discount_amount
    into v_auto_discount
    from public.claim_ticket_automatic_discount(
      v_auto_discount_rule_id,
      p_date,
      v_expected_gross,
      v_expected_unit_price,
      coalesce(v_game_options[1], 'laser-tag'),
      p_player_count,
      p_start_time,
      p_ticket_type,
      v_user_id
    ) as claim
    limit 1;

    if not found or v_auto_discount is distinct from v_applied_discount then
      raise exception 'Automatic discount is no longer available for this booking.';
    end if;
  end if;

  v_default_game := coalesce(v_game_options[1], 'laser-tag');
  v_ticket_reference := 'TKT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id,
    ticket_discount_rule_id,
    ticket_discount_code
  ) values (
    v_user_id,
    null,
    'game',
    'Ticket booking - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    p_arena_count,
    array[]::text[],
    '{}'::jsonb,
    null,
    'private',
    v_invite_code,
    coalesce(v_special_note, 'Private ticket booking'),
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'ticket',
    p_ticket_type,
    p_player_count,
    v_expected_unit_price,
    v_expected_total,
    'confirmed',
    v_ticket_reference,
    v_user_id,
    case
      when v_discount_source = 'voucher' then v_discount.id
      when v_auto_discount_rule_id is not null and v_auto_discount > 0 then v_auto_discount_rule_id
      else null
    end,
    v_applied_discount_code
  )
  returning id into v_session_id;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    payment_amount
  ) values (
    v_session_id,
    v_user_id,
    coalesce(v_profile.nickname, v_profile.full_name, v_profile.phone, 'Player'),
    v_profile.avatar_url,
    v_profile.avatar_emoji,
    v_profile.avatar_initials,
    v_profile.avatar_color,
    v_profile.avatar_text_color,
    v_profile.profile_motto,
    v_expected_total
  );

  if v_loyalty_points_to_redeem > 0 then
    select result.loyalty_points_total
    into v_loyalty_balance_after
    from public.apply_loyalty_points_delta(
      v_user_id,
      -v_loyalty_points_to_redeem,
      null,
      'ticket_redemption',
      v_session_id,
      'Ticket loyalty redemption',
      v_user_id
    ) as result;
  else
    v_loyalty_balance_after := coalesce(v_profile.loyalty_points_total, 0);
  end if;

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'confirmed',
    'discount_code', v_applied_discount_code,
    'discount_amount', case when v_discount_source = 'voucher' then v_applied_discount else 0 end,
    'discount_source', v_discount_source,
    'loyalty_points_total', v_loyalty_balance_after,
    'loyalty_points_redeemed', v_loyalty_points_to_redeem,
    'loyalty_discount_amount', v_loyalty_discount
  );
end;
$$;


ALTER FUNCTION "public"."create_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_loyalty_points_to_redeem" integer, "p_discount_code" "text", "p_special_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_staff_actor_profile_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_actor is null then
    return null;
  end if;
  if v_email = 'contact@vre-vietnam.com' then
    return private.current_staff_kiosk_operator_profile_id();
  end if;
  return v_actor;
end;
$$;


ALTER FUNCTION "public"."current_staff_actor_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_staff_operator_session_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
  select private.current_staff_kiosk_session_id()
$$;


ALTER FUNCTION "public"."current_staff_operator_session_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_staff_role_key"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
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


ALTER FUNCTION "public"."current_staff_role_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_staff_role_rank"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_profile_role text;
begin
  if v_actor is null then
    return 0;
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
    return private.current_staff_kiosk_role_rank();
  end if;

  return greatest(
    public.staff_role_rank(v_profile_role, null),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, v_jwt_email)
  );
end;
$$;


ALTER FUNCTION "public"."current_staff_role_rank"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_staff_payroll_compliance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_settings public.staff_hr_settings%rowtype;
  v_policy jsonb;
  v_employee public.staff_employee_profiles%rowtype;
  v_period_end date;
  v_contribution_base bigint := 0;
  v_employee_rate numeric := 0;
  v_employer_rate numeric := 0;
  v_trade_union_rate numeric := 0;
  v_taxable_income bigint := 0;
  v_original_overtime_pay bigint := 0;
  v_hourly_rate numeric := 0;
  v_regular_overtime_minutes integer := 0;
  v_night_overtime_minutes integer := 0;
  v_holiday_overtime_minutes integer := 0;
begin
  select run.period_end into v_period_end
  from public.staff_payroll_runs run where run.id = new.payroll_run_id;

  select * into v_settings from public.staff_hr_settings where id = 'default';
  select version.settings into v_policy
  from public.staff_hr_policy_versions version
  where version.policy_status = 'active'
    and version.effective_from <= coalesce(v_period_end, current_date)
  order by version.effective_from desc, version.updated_at desc
  limit 1;
  if v_policy is not null then
    v_settings := jsonb_populate_record(v_settings, v_policy);
  end if;

  select * into v_employee
  from public.staff_employee_profiles employee
  where employee.profile_id = new.profile_id;

  -- Attendance category minutes overlap in the legacy function. Rebuild overtime
  -- once, with holiday taking priority over night and night over ordinary OT.
  v_original_overtime_pay := coalesce(new.overtime_pay_vnd, 0);
  v_hourly_rate := coalesce(
    nullif(new.payslip_snapshot ->> 'payrollHourlyRateVnd', '')::numeric,
    nullif(v_employee.hourly_rate_vnd, 0),
    nullif(v_employee.base_salary_vnd, 0) / greatest(1, v_settings.standard_monthly_hours),
    0
  );
  v_holiday_overtime_minutes := least(greatest(0, coalesce(new.holiday_minutes, 0)), greatest(0, coalesce(new.overtime_minutes, 0)));
  v_night_overtime_minutes := least(
    greatest(0, coalesce(new.night_minutes, 0)),
    greatest(0, coalesce(new.overtime_minutes, 0) - v_holiday_overtime_minutes)
  );
  v_regular_overtime_minutes := greatest(0, coalesce(new.overtime_minutes, 0) - v_holiday_overtime_minutes - v_night_overtime_minutes);
  new.overtime_pay_vnd := round(
    (v_regular_overtime_minutes / 60.0) * v_hourly_rate * v_settings.normal_overtime_multiplier
    + (v_night_overtime_minutes / 60.0) * v_hourly_rate * (
      v_settings.normal_overtime_multiplier
      + v_settings.night_work_bonus_rate / 100.0
      + v_settings.night_overtime_extra_rate / 100.0
    )
    + (v_holiday_overtime_minutes / 60.0) * v_hourly_rate * v_settings.holiday_overtime_multiplier
  );
  new.gross_income_vnd := greatest(0, new.gross_income_vnd - v_original_overtime_pay + new.overtime_pay_vnd);

  if v_settings.social_insurance_enabled
    and coalesce(v_employee.social_insurance_enrolled, false)
    and coalesce(v_employee.contract_status, '') = 'active'
  then
    v_contribution_base := greatest(0, coalesce(nullif(v_employee.social_insurance_salary_vnd, 0), nullif(v_employee.base_salary_vnd, 0), 0));
    v_employee_rate := v_settings.employee_social_insurance_rate
      + v_settings.employee_health_insurance_rate
      + v_settings.employee_unemployment_insurance_rate;
    v_employer_rate := v_settings.employer_social_insurance_rate
      + v_settings.employer_health_insurance_rate
      + v_settings.employer_unemployment_insurance_rate;
    v_trade_union_rate := v_settings.employer_trade_union_rate;
  end if;

  new.employee_contributions_vnd := round(v_contribution_base * v_employee_rate / 100.0);
  new.employer_contributions_vnd := round(v_contribution_base * (v_employer_rate + v_trade_union_rate) / 100.0);

  v_taxable_income := greatest(
    0,
    new.gross_income_vnd
      - new.employee_contributions_vnd
      - v_settings.personal_deduction_vnd
      - greatest(0, coalesce(v_employee.dependents_count, 0)) * v_settings.dependent_deduction_vnd
  );
  if not v_settings.personal_income_tax_enabled then
    new.pit_withholding_vnd := 0;
  elsif coalesce(v_employee.pit_withholding_rate, 0) > 0 then
    new.pit_withholding_vnd := round(greatest(0, new.gross_income_vnd - new.employee_contributions_vnd) * v_employee.pit_withholding_rate / 100.0);
  else
    new.pit_withholding_vnd := public.staff_progressive_pit(v_taxable_income, v_settings.pit_brackets);
  end if;

  new.net_income_vnd := greatest(0, new.gross_income_vnd - new.employee_contributions_vnd - new.pit_withholding_vnd - new.deductions_vnd - new.advances_vnd);
  new.company_cost_vnd := greatest(0, new.gross_income_vnd + new.employer_contributions_vnd);
  new.payslip_snapshot := coalesce(new.payslip_snapshot, '{}'::jsonb) || jsonb_build_object(
    'policyVersion', v_settings.policy_version,
    'policyEffectiveFrom', v_settings.effective_from,
    'taxableIncomeVnd', v_taxable_income,
    'employeeContributionRate', v_employee_rate,
    'employerContributionRate', v_employer_rate,
    'tradeUnionRate', v_trade_union_rate,
    'legalSourceUrl', v_settings.legal_source_url
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_staff_payroll_compliance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_unique_player_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_conflict_id uuid;
  v_nickname text := public.normalize_player_identity(new.nickname);
begin
  if new.deleted_at is not null
    or coalesce(new.is_hr_record_only, false)
    or v_nickname is null
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('profile_nickname:' || v_nickname, 0));

  select profiles.id
  into v_conflict_id
  from public.profiles
  where profiles.deleted_at is null
    and not coalesce(profiles.is_hr_record_only, false)
    and profiles.id is distinct from new.id
    and public.normalize_player_identity(profiles.nickname) = v_nickname
  limit 1;

  if v_conflict_id is not null then
    raise exception using
      errcode = '23505',
      message = 'Player nickname is already in use.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_unique_player_identity"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_unique_player_identity"() IS 'Allows repeated full names while enforcing case-insensitive, trimmed nickname uniqueness for active player profiles.';



CREATE OR REPLACE FUNCTION "public"."enqueue_club_admin_message_push"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_recipient record;
  v_club_name text;
begin
  if new.message_type <> 'admin_private' or new.deleted_at is not null then
    return new;
  end if;

  select name
  into v_club_name
  from public.clubs
  where id = new.club_id;

  for v_recipient in
    select owner_id as profile_id
    from public.clubs
    where id = new.club_id
      and owner_id is distinct from new.author_id
    union
    select profile_id
    from public.club_members
    where club_id = new.club_id
      and status = 'approved'
      and role = 'admin'
      and deleted_at is null
      and profile_id is distinct from new.author_id
  loop
    perform public.enqueue_push_event(
      v_recipient.profile_id,
      'club-admin-message:' || new.id::text || ':' || v_recipient.profile_id::text,
      'club_admin_message',
      null,
      'Club admin message',
      coalesce(nullif(v_club_name, ''), 'VRena club') || ': ' || left(new.body, 90),
      '/',
      jsonb_build_object('club_id', new.club_id, 'message_id', new.id),
      now()
    );
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_club_admin_message_push"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_club_session_push"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_recipient record;
begin
  if new.club_id is null or new.deleted_at is not null then
    return new;
  end if;

  for v_recipient in
    select owner_id as profile_id
    from public.clubs
    where id = new.club_id
      and owner_id is distinct from new.owner_id
    union
    select profile_id
    from public.club_members
    where club_id = new.club_id
      and status = 'approved'
      and deleted_at is null
      and profile_id is distinct from new.owner_id
  loop
    perform public.enqueue_push_event(
      v_recipient.profile_id,
      'club-session:' || new.id::text || ':' || v_recipient.profile_id::text,
      'club_session_created',
      new.id,
      'New club session',
      public.push_session_body(new.name, new.date, new.start_time),
      '/',
      jsonb_build_object('club_id', new.club_id),
      now()
    );
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_club_session_push"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_due_session_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    with active_sessions as (
      select
        sessions.id,
        sessions.name,
        sessions.date,
        sessions.start_time,
        (sessions.date::timestamp + sessions.start_time::time) as starts_at
      from public.sessions
      where sessions.status <> 'cancelled'
        and sessions.deleted_at is null
        and (sessions.date::timestamp + sessions.start_time::time) > now() - interval '10 minutes'
        and (sessions.date::timestamp + sessions.start_time::time) <= now() + interval '25 hours'
    )
    select distinct
      participants.profile_id,
      active_sessions.id as session_id,
      active_sessions.name,
      active_sessions.date,
      active_sessions.start_time,
      reminders.key,
      reminders.title,
      reminders.scheduled_for
    from active_sessions
    join public.session_participants as participants
      on participants.session_id = active_sessions.id
     and participants.deleted_at is null
    cross join lateral (
      values
        ('24h'::text, 'Session tomorrow'::text, active_sessions.starts_at - interval '24 hours'),
        ('2h'::text, 'Session soon'::text, active_sessions.starts_at - interval '2 hours')
    ) as reminders(key, title, scheduled_for)
    where reminders.scheduled_for <= now() + interval '5 minutes'
      and reminders.scheduled_for >= now() - interval '6 hours'
  loop
    if public.enqueue_push_event(
      v_row.profile_id,
      'session-reminder:' || v_row.key || ':' || v_row.session_id::text,
      'session_reminder',
      v_row.session_id,
      v_row.title,
      public.push_session_body(v_row.name, v_row.date, v_row.start_time),
      '/',
      jsonb_build_object('reminder', v_row.key),
      v_row.scheduled_for
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."enqueue_due_session_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_event"("p_recipient_id" "uuid", "p_event_key" "text", "p_event_type" "text", "p_session_id" "uuid", "p_title" "text", "p_body" "text", "p_url" "text" DEFAULT '/'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_scheduled_for" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_inserted integer := 0;
begin
  if p_recipient_id is null or nullif(btrim(coalesce(p_event_key, '')), '') is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_recipient_id
      and profiles.deleted_at is null
  ) then
    return false;
  end if;

  insert into public.push_events (
    recipient_id,
    event_key,
    event_type,
    session_id,
    title,
    body,
    url,
    metadata,
    scheduled_for
  )
  values (
    p_recipient_id,
    p_event_key,
    p_event_type,
    p_session_id,
    coalesce(nullif(btrim(p_title), ''), 'VRena'),
    coalesce(nullif(btrim(p_body), ''), 'New VRena update.'),
    coalesce(nullif(btrim(p_url), ''), '/'),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_scheduled_for, now())
  )
  on conflict (event_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;


ALTER FUNCTION "public"."enqueue_push_event"("p_recipient_id" "uuid", "p_event_key" "text", "p_event_type" "text", "p_session_id" "uuid", "p_title" "text", "p_body" "text", "p_url" "text", "p_metadata" "jsonb", "p_scheduled_for" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_session_change_push"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_participant record;
  v_title text;
  v_key_prefix text;
begin
  if old.name is not distinct from new.name
    and old.date is not distinct from new.date
    and old.start_time is not distinct from new.start_time
    and old.duration_minutes is not distinct from new.duration_minutes
    and old.status is not distinct from new.status
  then
    return new;
  end if;

  v_title := case
    when new.status = 'cancelled' and old.status is distinct from new.status then 'Session cancelled'
    else 'Session updated'
  end;
  v_key_prefix := case
    when new.status = 'cancelled' and old.status is distinct from new.status then 'session-cancelled'
    else 'session-updated'
  end;

  for v_participant in
    select profile_id
    from public.session_participants
    where session_id = new.id
      and deleted_at is null
  loop
    perform public.enqueue_push_event(
      v_participant.profile_id,
      v_key_prefix || ':' || new.id::text || ':' || v_participant.profile_id::text || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
      v_key_prefix,
      new.id,
      v_title,
      public.push_session_body(new.name, new.date, new.start_time),
      '/',
      jsonb_build_object('status', new.status),
      now()
    );
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_session_change_push"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_session_invite_push"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session record;
  v_title text;
begin
  select name, date, start_time, booking_type
  into v_session
  from public.sessions
  where id = new.session_id
    and deleted_at is null;

  if not found then
    return new;
  end if;

  v_title := case
    when coalesce(v_session.booking_type, 'community') = 'challenge' then 'Challenge invite'
    else 'Session invitation'
  end;

  perform public.enqueue_push_event(
    new.recipient_id,
    'session-invite:' || new.id::text,
    'session_invite',
    new.session_id,
    v_title,
    public.push_session_body(v_session.name, v_session.date, v_session.start_time),
    '/',
    jsonb_build_object('invite_id', new.id),
    now()
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_session_invite_push"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_waitlist_promotion_push"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session record;
begin
  if not exists (
    select 1
    from public.session_participants
    where session_id = old.session_id
      and profile_id = old.profile_id
      and deleted_at is null
  ) then
    return old;
  end if;

  select name, date, start_time
  into v_session
  from public.sessions
  where id = old.session_id
    and deleted_at is null;

  if not found then
    return old;
  end if;

  perform public.enqueue_push_event(
    old.profile_id,
    'waitlist-promoted:' || old.session_id::text || ':' || old.profile_id::text,
    'waitlist_promoted',
    old.session_id,
    'Seat confirmed',
    public.push_session_body(v_session.name, v_session.date, v_session.start_time),
    '/',
    '{}'::jsonb,
    now()
  );

  return old;
end;
$$;


ALTER FUNCTION "public"."enqueue_waitlist_promotion_push"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "nickname" "text",
    "email" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "personal_data_consent" boolean DEFAULT false NOT NULL,
    "personal_data_consent_at" timestamp with time zone,
    "privacy_policy_url" "text",
    "avatar_emoji" "text",
    "avatar_initials" "text",
    "avatar_color" "text",
    "profile_motto" "text",
    "avatar_text_color" "text",
    "birthday" "date",
    "score_adjustment" integer DEFAULT 0 NOT NULL,
    "is_seed_demo" boolean DEFAULT false NOT NULL,
    "seed_batch" "text",
    "anonymous_mode" boolean DEFAULT false NOT NULL,
    "anonymous_callsign" "text",
    "marketing_consent" boolean DEFAULT true NOT NULL,
    "marketing_consent_at" timestamp with time zone,
    "marketing_opted_out_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "banned_at" timestamp with time zone,
    "banned_by" "uuid",
    "ban_reason" "text",
    "loyalty_points_total" integer DEFAULT 0 NOT NULL,
    "gender" "text",
    "average_accuracy_override" double precision,
    "best_escape_duration_seconds_override" integer,
    "total_projectiles_override" integer,
    "terms_conditions_url" "text",
    "consent_waiver_url" "text",
    "legal_consent_version" "text",
    "total_hits_override" integer,
    "onboarding_tour_completed_at" timestamp with time zone,
    "is_hr_record_only" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_avatar_text_color_hex" CHECK ((("avatar_text_color" IS NULL) OR ("avatar_text_color" ~ '^#[0-9A-Fa-f]{6}$'::"text"))),
    CONSTRAINT "profiles_average_accuracy_override_check" CHECK ((("average_accuracy_override" IS NULL) OR (("average_accuracy_override" >= (0)::double precision) AND ("average_accuracy_override" <= (100)::double precision)))),
    CONSTRAINT "profiles_best_escape_duration_seconds_override_check" CHECK ((("best_escape_duration_seconds_override" IS NULL) OR ("best_escape_duration_seconds_override" > 0))),
    CONSTRAINT "profiles_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'non_binary'::"text", 'prefer_not_to_say'::"text", 'self_describe'::"text"])))),
    CONSTRAINT "profiles_loyalty_points_total_check" CHECK (("loyalty_points_total" >= 0)),
    CONSTRAINT "profiles_profile_motto_length" CHECK ((("profile_motto" IS NULL) OR ("char_length"("profile_motto") <= 20))),
    CONSTRAINT "profiles_role_check" CHECK ((("role" IS NULL) OR ("lower"("role") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'cashier'::"text", 'viewer'::"text", 'player'::"text", 'employee'::"text"])))),
    CONSTRAINT "profiles_total_hits_override_check" CHECK ((("total_hits_override" IS NULL) OR ("total_hits_override" >= 0))),
    CONSTRAINT "profiles_total_projectiles_override_check" CHECK ((("total_projectiles_override" IS NULL) OR ("total_projectiles_override" >= 0)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."role" IS 'Authenticated web-app role. Employee is reserved for the contact@vre-vietnam.com shared store account; staff permissions come from employee PIN sessions.';



COMMENT ON COLUMN "public"."profiles"."gender" IS 'Optional self-reported profile gender for user preferences and consented marketing segmentation.';



COMMENT ON COLUMN "public"."profiles"."is_hr_record_only" IS 'Internal HR identity without an auth.users login. Created only by the service-role HR employee API.';



CREATE OR REPLACE FUNCTION "public"."ensure_guest_ticket_profile"("p_guest_phone" "text", "p_guest_name" "text" DEFAULT NULL::"text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_guest_phone text := public.normalize_guest_ticket_phone(p_guest_phone);
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_guest_id uuid;
  v_guest_email text;
  v_profile public.profiles%rowtype;
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  select *
  into v_profile
  from public.profiles profiles
  where profiles.phone = v_guest_phone
    and profiles.deleted_at is null
    and public.profile_has_account(profiles.id) is not true
  order by profiles.created_at desc nulls last
  limit 1
  for update;

  if found then
    if v_guest_name is not null and nullif(btrim(coalesce(v_profile.full_name, '')), '') is null then
      update public.profiles
      set full_name = v_guest_name,
          updated_at = now()
      where id = v_profile.id
      returning * into v_profile;
    end if;

    return v_profile;
  end if;

  v_guest_id := gen_random_uuid();
  v_guest_email := 'guest-ticket-' || replace(v_guest_id::text, '-', '') || '@vrena.guest.invalid';

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    reauthentication_token
  )
  values (
    v_guest_id,
    'authenticated',
    'authenticated',
    v_guest_email,
    null,
    null,
    jsonb_build_object(
      'provider', 'guest_ticket',
      'providers', jsonb_build_array('guest_ticket'),
      'guest_ticket', true
    ),
    jsonb_build_object(
      'phone', v_guest_phone,
      'full_name', v_guest_name,
      'guest_ticket', true
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    ''
  );

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    role,
    score_adjustment,
    anonymous_mode,
    marketing_consent
  ) values (
    v_guest_id,
    v_guest_phone,
    v_guest_name,
    null,
    null,
    null,
    null,
    null,
    '#3059ff',
    '#ffffff',
    null,
    'player',
    0,
    false,
    false
  )
  returning * into v_profile;

  return v_profile;
end;
$$;


ALTER FUNCTION "public"."ensure_guest_ticket_profile"("p_guest_phone" "text", "p_guest_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_active_loyalty_rule"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.active = true then
    update public.staff_loyalty_rules
    set active = false,
        updated_at = now()
    where active = true
      and id <> new.id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_single_active_loyalty_rule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard_players"() RETURNS TABLE("profile_id" "uuid", "display_name" "text", "avatar_url" "text", "avatar_emoji" "text", "avatar_initials" "text", "avatar_color" "text", "avatar_text_color" "text", "profile_motto" "text", "sessions_joined" integer, "games_joined" integer, "wins" integer, "best_performer_count" integer, "base_total_score" integer, "total_score" integer, "score_adjustment" integer, "total_accuracy" double precision, "accuracy_count" integer, "total_projectiles" integer, "average_accuracy" double precision, "reliability_score" double precision, "best_by_game" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    page_rows.profile_id,
    page_rows.display_name,
    page_rows.avatar_url,
    page_rows.avatar_emoji,
    page_rows.avatar_initials,
    page_rows.avatar_color,
    page_rows.avatar_text_color,
    page_rows.profile_motto,
    page_rows.sessions_joined,
    page_rows.games_joined,
    page_rows.wins,
    page_rows.best_performer_count,
    page_rows.base_total_score,
    page_rows.total_score,
    page_rows.score_adjustment,
    page_rows.total_accuracy,
    page_rows.accuracy_count,
    page_rows.total_projectiles,
    page_rows.average_accuracy,
    page_rows.reliability_score,
    page_rows.best_by_game
  from public.get_leaderboard_players_page(5000, 0, null, 'totalScore', null, null, null) as page_rows;
$$;


ALTER FUNCTION "public"."get_leaderboard_players"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard_players_page"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text", "p_rank_by" "text" DEFAULT 'totalScore'::"text", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_club_id" "uuid" DEFAULT NULL::"uuid", "p_club_pin" "text" DEFAULT NULL::"text") RETURNS TABLE("profile_id" "uuid", "display_name" "text", "avatar_url" "text", "avatar_emoji" "text", "avatar_initials" "text", "avatar_color" "text", "avatar_text_color" "text", "profile_motto" "text", "sessions_joined" integer, "games_joined" integer, "wins" integer, "best_performer_count" integer, "base_total_score" integer, "total_score" integer, "score_adjustment" integer, "total_accuracy" double precision, "accuracy_count" integer, "total_projectiles" integer, "average_accuracy" double precision, "reliability_score" double precision, "best_by_game" "jsonb", "leaderboard_rank" integer, "leaderboard_distinct_rank" integer, "leaderboard_higher_metric_value" double precision, "leaderboard_metric_value" double precision, "leaderboard_total_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with normalized_args as (
    select
      greatest(1, least(coalesce(p_limit, 20), 5000))::integer as page_limit,
      greatest(0, coalesce(p_offset, 0))::integer as page_offset,
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by
  ),
  session_rows as (
    select *
    from public.get_leaderboard_players_page_session_only(
      5000,
      0,
      p_search,
      'totalScore',
      null,
      p_club_id,
      p_club_pin
    )
  ),
  calculated_rows as (
    select
      session_rows.profile_id,
      session_rows.display_name,
      session_rows.avatar_url,
      session_rows.avatar_emoji,
      session_rows.avatar_initials,
      session_rows.avatar_color,
      session_rows.avatar_text_color,
      session_rows.profile_motto,
      session_rows.sessions_joined,
      session_rows.games_joined,
      session_rows.wins,
      session_rows.best_performer_count,
      (
        session_rows.base_total_score
        + coalesce(unmatched_venue_totals.total_score, 0)
      )::integer as base_total_score,
      (
        session_rows.base_total_score
        + coalesce(unmatched_venue_totals.total_score, 0)
        + session_rows.score_adjustment
      )::integer as total_score,
      session_rows.score_adjustment,
      (
        session_rows.total_accuracy
        + coalesce(unmatched_venue_totals.total_accuracy, 0)
      )::double precision as total_accuracy,
      (
        session_rows.accuracy_count
        + coalesce(unmatched_venue_totals.accuracy_count, 0)
      )::integer as accuracy_count,
      (
        session_rows.total_projectiles
        + coalesce(unmatched_venue_totals.total_hits, 0)
      )::integer as total_projectiles,
      case
        when session_rows.accuracy_count + coalesce(unmatched_venue_totals.accuracy_count, 0) > 0
        then (
          session_rows.total_accuracy
          + coalesce(unmatched_venue_totals.total_accuracy, 0)
        ) / (
          session_rows.accuracy_count
          + coalesce(unmatched_venue_totals.accuracy_count, 0)
        )
        else null
      end::double precision as average_accuracy,
      session_rows.reliability_score,
      coalesce(merged_game_scores.best_by_game, session_rows.best_by_game, '[]'::jsonb) as best_by_game,
      merged_game_scores.best_escape_duration_seconds
    from session_rows
    left join lateral (
      select
        coalesce(sum(venue_results.score), 0)::integer as total_score,
        coalesce(sum(venue_results.hits), 0)::integer as total_hits,
        coalesce(sum(venue_results.accuracy_percent) filter (
          where venue_results.accuracy_percent is not null
        ), 0)::double precision as total_accuracy,
        count(venue_results.accuracy_percent) filter (
          where venue_results.accuracy_percent is not null
        )::integer as accuracy_count
      from public.venue_game_results venue_results
      where venue_results.profile_id = session_rows.profile_id
        and venue_results.matched_participant_id is null
    ) unmatched_venue_totals on true
    left join lateral (
      select
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'game',
            combined_scores.game_slug,
            'score',
            combined_scores.best_score,
            'escapeDurationSeconds',
            combined_scores.best_escape_duration_seconds
          ))
          order by
            combined_scores.best_escape_duration_seconds asc nulls last,
            combined_scores.best_score desc,
            combined_scores.game_slug
        ) as best_by_game,
        min(combined_scores.best_escape_duration_seconds) filter (
          where combined_scores.best_escape_duration_seconds is not null
        )::integer as best_escape_duration_seconds
      from (
        select
          score_rows.game_slug,
          max(score_rows.score)::integer as best_score,
          min(score_rows.escape_duration_seconds) filter (
            where score_rows.escape_duration_seconds is not null
              and score_rows.escape_duration_seconds > 0
          )::integer as best_escape_duration_seconds
        from (
          select
            nullif(session_score ->> 'game', '') as game_slug,
            nullif(session_score ->> 'score', '')::integer as score,
            nullif(session_score ->> 'escapeDurationSeconds', '')::integer as escape_duration_seconds
          from jsonb_array_elements(coalesce(session_rows.best_by_game, '[]'::jsonb)) session_score
          where nullif(session_score ->> 'game', '') is not null
            and nullif(session_score ->> 'score', '') is not null

          union all

          select
            venue_results.game_slug,
            venue_results.score,
            null::integer as escape_duration_seconds
          from public.venue_game_results venue_results
          where venue_results.profile_id = session_rows.profile_id
            and venue_results.game_slug is not null
        ) score_rows
        group by score_rows.game_slug
      ) combined_scores
    ) merged_game_scores on true
  ),
  metric_rows as (
    select
      calculated_rows.*,
      case normalized_args.rank_by
        when 'wins' then calculated_rows.wins::double precision
        when 'winRate' then case
          when calculated_rows.games_joined > 0
          then (
            calculated_rows.wins::double precision
            / calculated_rows.games_joined::double precision
          ) * 100
          else 0
        end
        when 'accuracy' then coalesce(calculated_rows.average_accuracy, 0)
        when 'reliability' then calculated_rows.reliability_score
        when 'projectiles' then calculated_rows.total_projectiles::double precision
        when 'gamesPlayed' then calculated_rows.games_joined::double precision
        when 'escapeTime' then coalesce(calculated_rows.best_escape_duration_seconds, 0)::double precision
        else calculated_rows.total_score::double precision
      end as metric_value
    from calculated_rows
    cross join normalized_args
  ),
  ranked_rows as (
    select
      metric_rows.*,
      (rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_rank,
      (dense_rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_distinct_rank,
      (row_number() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last,
          metric_rows.total_score desc,
          metric_rows.best_performer_count desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count
    from metric_rows
    cross join normalized_args
  )
  select
    ranked_rows.profile_id,
    ranked_rows.display_name,
    ranked_rows.avatar_url,
    ranked_rows.avatar_emoji,
    ranked_rows.avatar_initials,
    ranked_rows.avatar_color,
    ranked_rows.avatar_text_color,
    ranked_rows.profile_motto,
    ranked_rows.sessions_joined,
    ranked_rows.games_joined,
    ranked_rows.wins,
    ranked_rows.best_performer_count,
    ranked_rows.base_total_score,
    ranked_rows.total_score,
    ranked_rows.score_adjustment,
    ranked_rows.total_accuracy,
    ranked_rows.accuracy_count,
    ranked_rows.total_projectiles,
    ranked_rows.average_accuracy,
    ranked_rows.reliability_score,
    ranked_rows.best_by_game,
    ranked_rows.leaderboard_rank,
    ranked_rows.leaderboard_distinct_rank,
    case
      when normalized_args.rank_by = 'escapeTime' then (
        select max(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > 0
          and higher_rows.metric_value < ranked_rows.metric_value
      )
      else (
        select min(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > ranked_rows.metric_value
      )
    end::double precision as leaderboard_higher_metric_value,
    ranked_rows.metric_value::double precision as leaderboard_metric_value,
    ranked_rows.leaderboard_total_count
  from ranked_rows
  cross join normalized_args
  where (
      p_profile_id is not null
      and ranked_rows.profile_id = p_profile_id
    )
    or (
      p_profile_id is null
      and ranked_rows.page_position > normalized_args.page_offset
      and ranked_rows.page_position <= normalized_args.page_offset + normalized_args.page_limit
    )
  order by ranked_rows.page_position;
$$;


ALTER FUNCTION "public"."get_leaderboard_players_page"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard_players_page_session_only"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text", "p_rank_by" "text" DEFAULT 'totalScore'::"text", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_club_id" "uuid" DEFAULT NULL::"uuid", "p_club_pin" "text" DEFAULT NULL::"text") RETURNS TABLE("profile_id" "uuid", "display_name" "text", "avatar_url" "text", "avatar_emoji" "text", "avatar_initials" "text", "avatar_color" "text", "avatar_text_color" "text", "profile_motto" "text", "sessions_joined" integer, "games_joined" integer, "wins" integer, "best_performer_count" integer, "base_total_score" integer, "total_score" integer, "score_adjustment" integer, "total_accuracy" double precision, "accuracy_count" integer, "total_projectiles" integer, "average_accuracy" double precision, "reliability_score" double precision, "best_by_game" "jsonb", "leaderboard_rank" integer, "leaderboard_distinct_rank" integer, "leaderboard_higher_metric_value" double precision, "leaderboard_metric_value" double precision, "leaderboard_total_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with normalized_args as (
    select
      greatest(1, least(coalesce(p_limit, 20), 5000))::integer as page_limit,
      greatest(0, coalesce(p_offset, 0))::integer as page_offset,
      nullif(trim(coalesce(p_search, '')), '') as search_value,
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by,
      nullif(regexp_replace(upper(coalesce(p_club_pin, '')), '[^A-Z0-9]', '', 'g'), '') as club_pin
  ),
  active_sessions as (
    select
      sessions.id,
      sessions.game_options
    from public.sessions
    where sessions.status <> 'cancelled'
      and sessions.deleted_at is null
  ),
  participant_rows as (
    select
      session_participants.id,
      session_participants.session_id,
      session_participants.profile_id,
      session_participants.checked_in,
      session_participants.score,
      session_participants.accuracy_percent,
      session_participants.projectiles_fired,
      session_participants.escape_duration_seconds,
      session_participants.placement,
      active_sessions.game_options
    from public.session_participants
    join active_sessions
      on active_sessions.id = session_participants.session_id
    where session_participants.deleted_at is null
  ),
  session_score_state as (
    select
      participant_rows.session_id,
      count(*)::integer as participant_count,
      count(participant_rows.score)::integer as scored_count,
      max(participant_rows.score) as best_score
    from participant_rows
    group by participant_rows.session_id
  ),
  unique_best_performers as (
    select
      participant_rows.id,
      participant_rows.session_id
    from participant_rows
    join session_score_state
      on session_score_state.session_id = participant_rows.session_id
    where session_score_state.participant_count >= 2
      and session_score_state.scored_count = session_score_state.participant_count
      and participant_rows.score = session_score_state.best_score
      and (
        select count(*)
        from participant_rows tied_rows
        where tied_rows.session_id = participant_rows.session_id
          and tied_rows.score = session_score_state.best_score
      ) = 1
  ),
  profile_stats as (
    select
      profiles.id as profile_id,
      count(participant_rows.id)::integer as sessions_joined,
      count(participant_rows.id) filter (where coalesce(participant_rows.checked_in, false))::integer as games_joined,
      count(participant_rows.id) filter (where participant_rows.placement = 1)::integer as wins,
      count(unique_best_performers.id)::integer as best_performer_count,
      coalesce(sum(participant_rows.score) filter (where participant_rows.score is not null), 0)::integer as base_total_score,
      coalesce(sum(participant_rows.accuracy_percent) filter (where participant_rows.accuracy_percent is not null), 0)::double precision as total_accuracy,
      count(participant_rows.accuracy_percent) filter (where participant_rows.accuracy_percent is not null)::integer as accuracy_count,
      coalesce(sum(participant_rows.projectiles_fired) filter (where participant_rows.projectiles_fired is not null), 0)::integer as total_projectiles,
      min(participant_rows.escape_duration_seconds) filter (
        where participant_rows.escape_duration_seconds is not null
          and participant_rows.escape_duration_seconds > 0
      )::integer as best_escape_duration_seconds
    from public.profiles
    left join participant_rows
      on participant_rows.profile_id = profiles.id
    left join unique_best_performers
      on unique_best_performers.id = participant_rows.id
    where profiles.deleted_at is null
    group by profiles.id
  ),
  participant_game_scores as (
    select
      participant_rows.profile_id,
      game_id,
      participant_rows.score,
      participant_rows.escape_duration_seconds
    from participant_rows
    cross join lateral unnest(coalesce(participant_rows.game_options, array[]::text[])) as game_id
    where participant_rows.score is not null
      or participant_rows.escape_duration_seconds is not null
  ),
  best_game_scores as (
    select
      participant_game_scores.profile_id,
      participant_game_scores.game_id,
      case
        when participant_game_scores.game_id in ('arc-of-the-covenant', 'joller-house') then min(participant_game_scores.score)
        else max(participant_game_scores.score)
      end::integer as score,
      min(participant_game_scores.escape_duration_seconds) filter (
        where participant_game_scores.game_id in ('arc-of-the-covenant', 'joller-house')
          and participant_game_scores.escape_duration_seconds is not null
          and participant_game_scores.escape_duration_seconds > 0
      )::integer as escape_duration_seconds
    from participant_game_scores
    group by participant_game_scores.profile_id, participant_game_scores.game_id
  ),
  best_game_json as (
    select
      best_game_scores.profile_id,
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'game',
          best_game_scores.game_id,
          'score',
          best_game_scores.score,
          'escapeDurationSeconds',
          best_game_scores.escape_duration_seconds
        ))
        order by
          best_game_scores.escape_duration_seconds asc nulls last,
          best_game_scores.score desc nulls last,
          best_game_scores.game_id
      ) as best_by_game
    from best_game_scores
    where best_game_scores.score is not null
      or best_game_scores.escape_duration_seconds is not null
    group by best_game_scores.profile_id
  ),
  base_rows as (
    select
      profiles.id as profile_id,
      public.profile_public_display_name(
        profiles.id,
        profiles.nickname,
        profiles.full_name,
        profiles.phone,
        profiles.anonymous_mode,
        profiles.anonymous_callsign
      ) as display_name,
      case when coalesce(profiles.anonymous_mode, false) then null else profiles.avatar_url end as avatar_url,
      case when coalesce(profiles.anonymous_mode, false) then '🎭' else profiles.avatar_emoji end as avatar_emoji,
      case when coalesce(profiles.anonymous_mode, false) then null else profiles.avatar_initials end as avatar_initials,
      case when coalesce(profiles.anonymous_mode, false) then '#11181b' else profiles.avatar_color end as avatar_color,
      case when coalesce(profiles.anonymous_mode, false) then '#ffffff' else profiles.avatar_text_color end as avatar_text_color,
      profiles.profile_motto,
      profile_stats.sessions_joined,
      profile_stats.games_joined,
      profile_stats.wins,
      profile_stats.best_performer_count,
      profile_stats.base_total_score,
      profile_stats.base_total_score + coalesce(profiles.score_adjustment, 0)::integer as total_score,
      coalesce(profiles.score_adjustment, 0)::integer as score_adjustment,
      profile_stats.total_accuracy,
      profile_stats.accuracy_count,
      profile_stats.total_projectiles,
      profile_stats.best_escape_duration_seconds,
      case
        when profile_stats.accuracy_count > 0 then profile_stats.total_accuracy / profile_stats.accuracy_count
        else null
      end as average_accuracy,
      case
        when profile_stats.sessions_joined > 0 then (profile_stats.games_joined::double precision / profile_stats.sessions_joined::double precision) * 100
        else 0
      end as reliability_score,
      coalesce(best_game_json.best_by_game, '[]'::jsonb) as best_by_game
    from public.profiles
    join profile_stats
      on profile_stats.profile_id = profiles.id
    left join best_game_json
      on best_game_json.profile_id = profiles.id
    where profiles.deleted_at is null
  ),
  current_profile as (
    select
      profiles.id,
      profiles.email,
      profiles.role
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.deleted_at is null
  ),
  selected_club as (
    select
      clubs.id,
      clubs.owner_id,
      clubs.visibility,
      nullif(regexp_replace(upper(coalesce(clubs.pin_code, '')), '[^A-Z0-9]', '', 'g'), '') as pin_code
    from public.clubs
    where clubs.id = p_club_id
  ),
  selected_club_access as (
    select
      selected_club.id,
      (
        selected_club.visibility = 'public'
        or selected_club.owner_id = auth.uid()
        or exists (
          select 1
          from current_profile
          where lower(coalesce(current_profile.role, '')) in ('super_admin', 'owner', 'admin')
            or lower(coalesce(current_profile.email, '')) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com')
        )
        or exists (
          select 1
          from public.club_members
          where club_members.club_id = selected_club.id
            and club_members.profile_id = auth.uid()
            and club_members.status = 'approved'
            and club_members.deleted_at is null
        )
        or exists (
          select 1
          from normalized_args
          where normalized_args.club_pin is not null
            and selected_club.pin_code is not null
            and normalized_args.club_pin = selected_club.pin_code
        )
      ) as can_view
    from selected_club
  ),
  selected_club_profile_ids as (
    select selected_club.owner_id as profile_id
    from selected_club
    join selected_club_access
      on selected_club_access.id = selected_club.id
     and selected_club_access.can_view
    union
    select club_members.profile_id
    from public.club_members
    join selected_club
      on selected_club.id = club_members.club_id
    join selected_club_access
      on selected_club_access.id = selected_club.id
     and selected_club_access.can_view
    where club_members.status = 'approved'
      and club_members.deleted_at is null
  ),
  filtered_rows as (
    select base_rows.*
    from base_rows
    cross join normalized_args
    where (
        normalized_args.search_value is null
        or lower(base_rows.display_name || ' ' || coalesce(base_rows.profile_motto, '')) like '%' || lower(normalized_args.search_value) || '%'
      )
      and (
        p_club_id is null
        or exists (
          select 1
          from selected_club_profile_ids
          where selected_club_profile_ids.profile_id = base_rows.profile_id
        )
      )
  ),
  metric_rows as (
    select
      filtered_rows.*,
      case normalized_args.rank_by
        when 'wins' then filtered_rows.wins::double precision
        when 'winRate' then case when filtered_rows.games_joined > 0 then (filtered_rows.wins::double precision / filtered_rows.games_joined::double precision) * 100 else 0 end
        when 'accuracy' then coalesce(filtered_rows.average_accuracy, 0)
        when 'reliability' then filtered_rows.reliability_score
        when 'projectiles' then filtered_rows.total_projectiles::double precision
        when 'gamesPlayed' then filtered_rows.games_joined::double precision
        when 'escapeTime' then coalesce(filtered_rows.best_escape_duration_seconds, 0)::double precision
        else filtered_rows.total_score::double precision
      end as metric_value
    from filtered_rows
    cross join normalized_args
  ),
  distinct_metric_values as (
    select
      distinct_values.metric_value,
      (dense_rank() over (
        order by
          case when normalized_args.rank_by = 'escapeTime' then distinct_values.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then distinct_values.metric_value end desc nulls last
      ))::integer as distinct_rank,
      lag(distinct_values.metric_value) over (
        order by
          case when normalized_args.rank_by = 'escapeTime' then distinct_values.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then distinct_values.metric_value end desc nulls last
      ) as higher_metric_value
    from (
      select distinct metric_rows.metric_value
      from metric_rows
      where metric_rows.metric_value > 0
    ) distinct_values
    cross join normalized_args
  ),
  ranked_rows as (
    select
      metric_rows.*,
      (rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_rank,
      (row_number() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last,
          metric_rows.total_score desc,
          metric_rows.best_performer_count desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count,
      distinct_metric_values.distinct_rank as leaderboard_distinct_rank,
      distinct_metric_values.higher_metric_value as leaderboard_higher_metric_value
    from metric_rows
    cross join normalized_args
    left join distinct_metric_values
      on distinct_metric_values.metric_value = metric_rows.metric_value
  )
  select
    ranked_rows.profile_id,
    ranked_rows.display_name,
    ranked_rows.avatar_url,
    ranked_rows.avatar_emoji,
    ranked_rows.avatar_initials,
    ranked_rows.avatar_color,
    ranked_rows.avatar_text_color,
    ranked_rows.profile_motto,
    ranked_rows.sessions_joined,
    ranked_rows.games_joined,
    ranked_rows.wins,
    ranked_rows.best_performer_count,
    ranked_rows.base_total_score,
    ranked_rows.total_score,
    ranked_rows.score_adjustment,
    ranked_rows.total_accuracy,
    ranked_rows.accuracy_count,
    ranked_rows.total_projectiles,
    ranked_rows.average_accuracy,
    ranked_rows.reliability_score,
    ranked_rows.best_by_game,
    ranked_rows.leaderboard_rank,
    ranked_rows.leaderboard_distinct_rank,
    ranked_rows.leaderboard_higher_metric_value,
    ranked_rows.metric_value as leaderboard_metric_value,
    ranked_rows.leaderboard_total_count
  from ranked_rows
  cross join normalized_args
  where (
      p_profile_id is not null
      and ranked_rows.profile_id = p_profile_id
    )
    or (
      p_profile_id is null
      and ranked_rows.page_position > normalized_args.page_offset
      and ranked_rows.page_position <= normalized_args.page_offset + normalized_args.page_limit
    )
  order by ranked_rows.page_position asc;
$$;


ALTER FUNCTION "public"."get_leaderboard_players_page_session_only"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard_players_page_v2"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text", "p_rank_by" "text" DEFAULT 'totalScore'::"text", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_club_id" "uuid" DEFAULT NULL::"uuid", "p_club_pin" "text" DEFAULT NULL::"text", "p_game_id" "text" DEFAULT NULL::"text") RETURNS TABLE("profile_id" "uuid", "display_name" "text", "avatar_url" "text", "avatar_emoji" "text", "avatar_initials" "text", "avatar_color" "text", "avatar_text_color" "text", "profile_motto" "text", "sessions_joined" integer, "games_joined" integer, "wins" integer, "best_performer_count" integer, "base_total_score" integer, "total_score" integer, "score_adjustment" integer, "total_accuracy" double precision, "accuracy_count" integer, "total_projectiles" integer, "total_movement_meters" double precision, "average_accuracy" double precision, "reliability_score" double precision, "best_by_game" "jsonb", "leaderboard_rank" integer, "leaderboard_distinct_rank" integer, "leaderboard_higher_metric_value" double precision, "leaderboard_metric_value" double precision, "leaderboard_total_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with normalized_args as (
    select
      greatest(1, least(coalesce(p_limit, 20), 5000))::integer as page_limit,
      greatest(0, coalesce(p_offset, 0))::integer as page_offset,
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by,
      nullif(lower(trim(coalesce(p_game_id, ''))), '') as game_id
  ),
  base_rows as (
    select *
    from public.get_leaderboard_players_page(
      5000,
      0,
      p_search,
      'totalScore',
      null,
      p_club_id,
      p_club_pin
    )
  ),
  result_rows as (
    select
      participants.profile_id,
      coalesce(sessions.confirmed_game_id, sessions.game_options[1]) as game_slug,
      participants.score,
      participants.hits,
      participants.accuracy_percent,
      participants.movement_meters::double precision as movement_meters
    from public.session_participants participants
    join public.sessions sessions
      on sessions.id = participants.session_id
    where participants.deleted_at is null
      and sessions.deleted_at is null
      and sessions.status <> 'cancelled'
      and coalesce(sessions.confirmed_game_id, sessions.game_options[1]) is not null
      and (
        participants.score is not null
        or participants.hits is not null
        or participants.accuracy_percent is not null
        or participants.movement_meters is not null
      )
      and not exists (
        select 1
        from public.venue_game_results linked_result
        where linked_result.matched_participant_id = participants.id
      )

    union all

    select
      venue_results.profile_id,
      venue_results.game_slug,
      venue_results.score,
      venue_results.hits,
      venue_results.accuracy_percent,
      venue_results.movement_meters::double precision
    from public.venue_game_results venue_results
    where venue_results.game_slug is not null
  ),
  game_stats as (
    select
      result_rows.profile_id,
      result_rows.game_slug,
      coalesce(sum(result_rows.score), 0)::integer as total_score,
      coalesce(sum(result_rows.hits), 0)::integer as total_hits,
      coalesce(sum(result_rows.movement_meters), 0)::double precision as total_movement_meters,
      coalesce(sum(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      ), 0)::double precision as total_accuracy,
      count(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      )::integer as accuracy_count,
      count(*)::integer as result_count
    from result_rows
    group by result_rows.profile_id, result_rows.game_slug
  ),
  overall_stats as (
    select
      result_rows.profile_id,
      coalesce(sum(result_rows.score), 0)::integer as total_score,
      coalesce(sum(result_rows.hits), 0)::integer as total_hits,
      coalesce(sum(result_rows.movement_meters), 0)::double precision as total_movement_meters,
      coalesce(sum(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      ), 0)::double precision as total_accuracy,
      count(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      )::integer as accuracy_count,
      count(*)::integer as result_count
    from result_rows
    group by result_rows.profile_id
  ),
  scoped_rows as (
    select
      base_rows.profile_id,
      base_rows.display_name,
      base_rows.avatar_url,
      base_rows.avatar_emoji,
      base_rows.avatar_initials,
      base_rows.avatar_color,
      base_rows.avatar_text_color,
      base_rows.profile_motto,
      base_rows.sessions_joined,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.result_count, 0)
        else coalesce(selected_game_stats.result_count, 0)
      end::integer as games_joined,
      base_rows.wins,
      base_rows.best_performer_count,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_score, 0)
        else coalesce(selected_game_stats.total_score, 0)
      end::integer as base_total_score,
      case
        when normalized_args.game_id is null
          then coalesce(overall_stats.total_score, 0) + base_rows.score_adjustment
        else coalesce(selected_game_stats.total_score, 0)
      end::integer as total_score,
      case
        when normalized_args.game_id is null then base_rows.score_adjustment
        else 0
      end::integer as score_adjustment,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_accuracy, 0)
        else coalesce(selected_game_stats.total_accuracy, 0)
      end::double precision as total_accuracy,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.accuracy_count, 0)
        else coalesce(selected_game_stats.accuracy_count, 0)
      end::integer as accuracy_count,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_hits, 0)
        else coalesce(selected_game_stats.total_hits, 0)
      end::integer as total_projectiles,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_movement_meters, 0)
        else coalesce(selected_game_stats.total_movement_meters, 0)
      end::double precision as total_movement_meters,
      case
        when normalized_args.game_id is null and coalesce(overall_stats.accuracy_count, 0) > 0
          then overall_stats.total_accuracy / overall_stats.accuracy_count
        when coalesce(selected_game_stats.accuracy_count, 0) > 0
        then selected_game_stats.total_accuracy / selected_game_stats.accuracy_count
        else null
      end::double precision as average_accuracy,
      base_rows.reliability_score,
      base_rows.best_by_game
    from base_rows
    cross join normalized_args
    left join game_stats selected_game_stats
      on selected_game_stats.profile_id = base_rows.profile_id
     and selected_game_stats.game_slug = normalized_args.game_id
    left join overall_stats
      on overall_stats.profile_id = base_rows.profile_id
  ),
  metric_rows as (
    select
      scoped_rows.*,
      case normalized_args.rank_by
        when 'wins' then scoped_rows.wins::double precision
        when 'winRate' then case
          when scoped_rows.games_joined > 0
          then (scoped_rows.wins::double precision / scoped_rows.games_joined::double precision) * 100
          else 0
        end
        when 'accuracy' then coalesce(scoped_rows.average_accuracy, 0)
        when 'reliability' then scoped_rows.reliability_score
        when 'projectiles' then scoped_rows.total_projectiles::double precision
        when 'hits' then scoped_rows.total_projectiles::double precision
        when 'movement' then scoped_rows.total_movement_meters
        when 'gamesPlayed' then scoped_rows.games_joined::double precision
        when 'escapeTime' then coalesce((
          select min(nullif(game_score ->> 'escapeDurationSeconds', '')::double precision)
          from jsonb_array_elements(coalesce(scoped_rows.best_by_game, '[]'::jsonb)) game_score
          where nullif(game_score ->> 'escapeDurationSeconds', '') is not null
            and (
              normalized_args.game_id is null
              or game_score ->> 'game' = normalized_args.game_id
            )
        ), 0)
        else scoped_rows.total_score::double precision
      end as metric_value
    from scoped_rows
    cross join normalized_args
  ),
  ranked_rows as (
    select
      metric_rows.*,
      (rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_rank,
      (dense_rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_distinct_rank,
      (row_number() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last,
          metric_rows.total_score desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count
    from metric_rows
    cross join normalized_args
  )
  select
    ranked_rows.profile_id,
    ranked_rows.display_name,
    ranked_rows.avatar_url,
    ranked_rows.avatar_emoji,
    ranked_rows.avatar_initials,
    ranked_rows.avatar_color,
    ranked_rows.avatar_text_color,
    ranked_rows.profile_motto,
    ranked_rows.sessions_joined,
    ranked_rows.games_joined,
    ranked_rows.wins,
    ranked_rows.best_performer_count,
    ranked_rows.base_total_score,
    ranked_rows.total_score,
    ranked_rows.score_adjustment,
    ranked_rows.total_accuracy,
    ranked_rows.accuracy_count,
    ranked_rows.total_projectiles,
    ranked_rows.total_movement_meters,
    ranked_rows.average_accuracy,
    ranked_rows.reliability_score,
    ranked_rows.best_by_game,
    ranked_rows.leaderboard_rank,
    ranked_rows.leaderboard_distinct_rank,
    case
      when normalized_args.rank_by = 'escapeTime' then (
        select max(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > 0
          and higher_rows.metric_value < ranked_rows.metric_value
      )
      else (
        select min(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > ranked_rows.metric_value
      )
    end::double precision,
    ranked_rows.metric_value::double precision,
    ranked_rows.leaderboard_total_count
  from ranked_rows
  cross join normalized_args
  where (
      p_profile_id is not null
      and ranked_rows.profile_id = p_profile_id
    )
    or (
      p_profile_id is null
      and ranked_rows.page_position > normalized_args.page_offset
      and ranked_rows.page_position <= normalized_args.page_offset + normalized_args.page_limit
    )
  order by ranked_rows.page_position;
$$;


ALTER FUNCTION "public"."get_leaderboard_players_page_v2"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard_players_page_v3"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text", "p_rank_by" "text" DEFAULT 'totalScore'::"text", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_club_id" "uuid" DEFAULT NULL::"uuid", "p_club_pin" "text" DEFAULT NULL::"text", "p_game_id" "text" DEFAULT NULL::"text") RETURNS TABLE("profile_id" "uuid", "display_name" "text", "avatar_url" "text", "avatar_emoji" "text", "avatar_initials" "text", "avatar_color" "text", "avatar_text_color" "text", "profile_motto" "text", "sessions_joined" integer, "games_joined" integer, "wins" integer, "best_performer_count" integer, "base_total_score" integer, "total_score" integer, "score_adjustment" integer, "total_accuracy" double precision, "accuracy_count" integer, "total_projectiles" integer, "total_movement_meters" double precision, "average_accuracy" double precision, "reliability_score" double precision, "best_by_game" "jsonb", "leaderboard_rank" integer, "leaderboard_distinct_rank" integer, "leaderboard_higher_metric_value" double precision, "leaderboard_metric_value" double precision, "leaderboard_total_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with normalized_args as (
    select
      greatest(1, least(coalesce(p_limit, 20), 5000))::integer as page_limit,
      greatest(0, coalesce(p_offset, 0))::integer as page_offset,
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by,
      nullif(lower(trim(coalesce(p_game_id, ''))), '') as game_id
  ),
  source_rows as (
    select *
    from public.get_leaderboard_players_page_v2(
      5000,
      0,
      p_search,
      'totalScore',
      null,
      p_club_id,
      p_club_pin,
      p_game_id
    )
  ),
  enhanced_rows as (
    select
      source_rows.profile_id,
      source_rows.display_name,
      source_rows.avatar_url,
      source_rows.avatar_emoji,
      source_rows.avatar_initials,
      source_rows.avatar_color,
      source_rows.avatar_text_color,
      source_rows.profile_motto,
      coalesce(active_override.sessions_joined, source_rows.sessions_joined)::integer as sessions_joined,
      coalesce(active_override.games_joined, source_rows.games_joined)::integer as games_joined,
      coalesce(active_override.wins, source_rows.wins)::integer as wins,
      coalesce(active_override.best_performer_count, source_rows.best_performer_count)::integer as best_performer_count,
      source_rows.base_total_score,
      coalesce(active_override.total_score, source_rows.total_score)::integer as total_score,
      (
        coalesce(active_override.total_score, source_rows.total_score)
        - source_rows.base_total_score
      )::integer as score_adjustment,
      case
        when active_override.average_accuracy is not null
          then active_override.average_accuracy * greatest(source_rows.accuracy_count, 1)
        else source_rows.total_accuracy
      end::double precision as total_accuracy,
      source_rows.accuracy_count,
      coalesce(active_override.total_projectiles, source_rows.total_projectiles)::integer as total_projectiles,
      coalesce(active_override.total_movement_meters, source_rows.total_movement_meters)::double precision as total_movement_meters,
      coalesce(active_override.average_accuracy, source_rows.average_accuracy)::double precision as average_accuracy,
      case
        when coalesce(active_override.sessions_joined, source_rows.sessions_joined) > 0
          then (
            coalesce(active_override.games_joined, source_rows.games_joined)::double precision
            / coalesce(active_override.sessions_joined, source_rows.sessions_joined)::double precision
          ) * 100
        else 0
      end::double precision as reliability_score,
      case
        when normalized_args.game_id is null
          and active_override.best_escape_duration_seconds is not null
        then coalesce((
          select jsonb_agg(game_score - 'escapeDurationSeconds')
          from jsonb_array_elements(
            coalesce(merged_games.best_by_game, source_rows.best_by_game, '[]'::jsonb)
          ) game_score
        ), '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'game', '__overall__',
          'escapeDurationSeconds', active_override.best_escape_duration_seconds
        ))
        else coalesce(merged_games.best_by_game, source_rows.best_by_game, '[]'::jsonb)
      end as best_by_game,
      active_override.best_escape_duration_seconds
    from source_rows
    cross join normalized_args
    left join public.player_stat_overrides active_override
      on active_override.profile_id = source_rows.profile_id
     and active_override.scope = coalesce(normalized_args.game_id, 'overall')
    left join lateral (
      with base_scores as (
        select
          nullif(score_row ->> 'game', '') as game_slug,
          nullif(score_row ->> 'score', '')::integer as score,
          nullif(score_row ->> 'escapeDurationSeconds', '')::integer as escape_duration_seconds
        from jsonb_array_elements(coalesce(source_rows.best_by_game, '[]'::jsonb)) score_row
      ),
      game_overrides as (
        select scoped_overrides.*
        from public.player_stat_overrides scoped_overrides
        where scoped_overrides.profile_id = source_rows.profile_id
          and scoped_overrides.scope <> 'overall'
      )
      select coalesce(
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'game', merged.game_slug,
            'score', merged.score,
            'escapeDurationSeconds', merged.escape_duration_seconds
          ))
          order by
            merged.escape_duration_seconds asc nulls last,
            merged.score desc,
            merged.game_slug
        ) filter (where merged.score is not null),
        '[]'::jsonb
      ) as best_by_game
      from (
        select
          coalesce(base_scores.game_slug, game_overrides.scope) as game_slug,
          coalesce(
            game_overrides.best_score,
            base_scores.score,
            game_overrides.total_score,
            case
              when coalesce(
                game_overrides.best_escape_duration_seconds,
                base_scores.escape_duration_seconds
              ) is not null
              then 0
            end
          )::integer as score,
          coalesce(
            game_overrides.best_escape_duration_seconds,
            base_scores.escape_duration_seconds
          )::integer as escape_duration_seconds
        from base_scores
        full outer join game_overrides
          on game_overrides.scope = base_scores.game_slug
      ) merged
    ) merged_games on true
  ),
  metric_rows as (
    select
      enhanced_rows.*,
      case normalized_args.rank_by
        when 'wins' then enhanced_rows.wins::double precision
        when 'winRate' then case
          when enhanced_rows.games_joined > 0
            then (enhanced_rows.wins::double precision / enhanced_rows.games_joined::double precision) * 100
          else 0
        end
        when 'accuracy' then coalesce(enhanced_rows.average_accuracy, 0)
        when 'reliability' then enhanced_rows.reliability_score
        when 'projectiles' then enhanced_rows.total_projectiles::double precision
        when 'hits' then enhanced_rows.total_projectiles::double precision
        when 'movement' then enhanced_rows.total_movement_meters
        when 'gamesPlayed' then enhanced_rows.games_joined::double precision
        when 'escapeTime' then coalesce(
          enhanced_rows.best_escape_duration_seconds,
          (
            select min(nullif(game_score ->> 'escapeDurationSeconds', '')::double precision)
            from jsonb_array_elements(coalesce(enhanced_rows.best_by_game, '[]'::jsonb)) game_score
            where nullif(game_score ->> 'escapeDurationSeconds', '') is not null
              and (
                normalized_args.game_id is null
                or game_score ->> 'game' = normalized_args.game_id
              )
          ),
          0
        )
        else enhanced_rows.total_score::double precision
      end as metric_value
    from enhanced_rows
    cross join normalized_args
  ),
  ranked_rows as (
    select
      metric_rows.*,
      (rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_rank,
      (dense_rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_distinct_rank,
      (row_number() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last,
          metric_rows.total_score desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count
    from metric_rows
    cross join normalized_args
  )
  select
    ranked_rows.profile_id,
    ranked_rows.display_name,
    ranked_rows.avatar_url,
    ranked_rows.avatar_emoji,
    ranked_rows.avatar_initials,
    ranked_rows.avatar_color,
    ranked_rows.avatar_text_color,
    ranked_rows.profile_motto,
    ranked_rows.sessions_joined,
    ranked_rows.games_joined,
    ranked_rows.wins,
    ranked_rows.best_performer_count,
    ranked_rows.base_total_score,
    ranked_rows.total_score,
    ranked_rows.score_adjustment,
    ranked_rows.total_accuracy,
    ranked_rows.accuracy_count,
    ranked_rows.total_projectiles,
    ranked_rows.total_movement_meters,
    ranked_rows.average_accuracy,
    ranked_rows.reliability_score,
    ranked_rows.best_by_game,
    ranked_rows.leaderboard_rank,
    ranked_rows.leaderboard_distinct_rank,
    case
      when normalized_args.rank_by = 'escapeTime' then (
        select max(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > 0
          and higher_rows.metric_value < ranked_rows.metric_value
      )
      else (
        select min(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > ranked_rows.metric_value
      )
    end::double precision,
    ranked_rows.metric_value::double precision,
    ranked_rows.leaderboard_total_count
  from ranked_rows
  cross join normalized_args
  where (
      p_profile_id is not null
      and ranked_rows.profile_id = p_profile_id
    )
    or (
      p_profile_id is null
      and ranked_rows.page_position > normalized_args.page_offset
      and ranked_rows.page_position <= normalized_args.page_offset + normalized_args.page_limit
    )
  order by ranked_rows.page_position;
$$;


ALTER FUNCTION "public"."get_leaderboard_players_page_v3"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_player_game_count_overrides"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    jsonb_object_agg(overrides.scope, overrides.games_joined order by overrides.scope),
    '{}'::jsonb
  )
  from public.player_stat_overrides overrides
  where overrides.profile_id = auth.uid()
    and overrides.scope <> 'overall'
    and overrides.games_joined is not null;
$$;


ALTER FUNCTION "public"."get_my_player_game_count_overrides"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_player_game_count_overrides"() IS 'Returns only the signed-in player game-count overrides used by shared achievement progress calculations.';



CREATE OR REPLACE FUNCTION "public"."get_soft_deleted_records"("p_limit" integer DEFAULT 100) RETURNS TABLE("entity_table" "text", "entity_id" "uuid", "label" "text", "deleted_at" timestamp with time zone, "deleted_by" "uuid", "delete_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_vrena_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  return query
  select rows.entity_table, rows.entity_id, rows.label, rows.deleted_at, rows.deleted_by, rows.delete_reason
  from (
    select
      'profiles'::text as entity_table,
      profiles.id as entity_id,
      coalesce(nullif(profiles.full_name, ''), nullif(profiles.email, ''), profiles.phone, profiles.id::text) as label,
      profiles.deleted_at,
      profiles.deleted_by,
      profiles.delete_reason
    from public.profiles
    where profiles.deleted_at is not null
    union all
    select
      'sessions'::text,
      sessions.id,
      coalesce(nullif(sessions.name, ''), sessions.id::text),
      sessions.deleted_at,
      sessions.deleted_by,
      sessions.delete_reason
    from public.sessions
    where sessions.deleted_at is not null
    union all
    select
      'session_participants'::text,
      session_participants.id,
      coalesce(nullif(session_participants.display_name, ''), session_participants.profile_id::text),
      session_participants.deleted_at,
      session_participants.deleted_by,
      session_participants.delete_reason
    from public.session_participants
    where session_participants.deleted_at is not null
    union all
    select
      'session_messages'::text,
      session_messages.id,
      coalesce(nullif(session_messages.author_display_name, ''), left(session_messages.body, 60), session_messages.id::text),
      session_messages.deleted_at,
      session_messages.deleted_by,
      session_messages.delete_reason
    from public.session_messages
    where session_messages.deleted_at is not null
    union all
    select
      'club_members'::text,
      club_members.id,
      coalesce(nullif(club_members.display_name, ''), club_members.profile_id::text),
      club_members.deleted_at,
      club_members.deleted_by,
      club_members.delete_reason
    from public.club_members
    where club_members.deleted_at is not null
    union all
    select
      'tournament_pools'::text,
      tournament_pools.id,
      coalesce(nullif(tournament_pools.name, ''), tournament_pools.id::text),
      tournament_pools.deleted_at,
      tournament_pools.deleted_by,
      tournament_pools.delete_reason
    from public.tournament_pools
    where tournament_pools.deleted_at is not null
    union all
    select
      'tournament_pool_entries'::text,
      tournament_pool_entries.id,
      coalesce(tournament_pool_entries.profile_id::text, tournament_pool_entries.participant_id::text, tournament_pool_entries.id::text),
      tournament_pool_entries.deleted_at,
      tournament_pool_entries.deleted_by,
      tournament_pool_entries.delete_reason
    from public.tournament_pool_entries
    where tournament_pool_entries.deleted_at is not null
    union all
    select
      'tournament_matches'::text,
      tournament_matches.id,
      coalesce(tournament_matches.stage || ' #' || tournament_matches.match_number::text, tournament_matches.id::text),
      tournament_matches.deleted_at,
      tournament_matches.deleted_by,
      tournament_matches.delete_reason
    from public.tournament_matches
    where tournament_matches.deleted_at is not null
  ) rows
  order by rows.deleted_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;


ALTER FUNCTION "public"."get_soft_deleted_records"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_soft_deleted_records_v2"("p_limit" integer DEFAULT 100) RETURNS TABLE("entity_table" "text", "entity_id" "uuid", "label" "text", "deleted_at" timestamp with time zone, "deleted_by" "uuid", "delete_reason" "text", "deleted_by_name" "text", "deleted_by_email" "text", "deleted_by_phone" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_vrena_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  return query
  select
    rows.entity_table,
    rows.entity_id,
    rows.label,
    rows.deleted_at,
    rows.deleted_by,
    rows.delete_reason,
    coalesce(nullif(actor.full_name, ''), nullif(actor.nickname, '')) as deleted_by_name,
    nullif(actor.email, '') as deleted_by_email,
    nullif(actor.phone, '') as deleted_by_phone
  from (
    select
      'profiles'::text as entity_table,
      profiles.id as entity_id,
      coalesce(nullif(profiles.full_name, ''), nullif(profiles.email, ''), profiles.phone, profiles.id::text) as label,
      profiles.deleted_at,
      profiles.deleted_by,
      profiles.delete_reason
    from public.profiles
    where profiles.deleted_at is not null
    union all
    select
      'sessions'::text,
      sessions.id,
      coalesce(nullif(sessions.name, ''), sessions.id::text),
      sessions.deleted_at,
      sessions.deleted_by,
      sessions.delete_reason
    from public.sessions
    where sessions.deleted_at is not null
    union all
    select
      'session_participants'::text,
      session_participants.id,
      coalesce(nullif(session_participants.display_name, ''), session_participants.profile_id::text),
      session_participants.deleted_at,
      session_participants.deleted_by,
      session_participants.delete_reason
    from public.session_participants
    where session_participants.deleted_at is not null
    union all
    select
      'session_messages'::text,
      session_messages.id,
      coalesce(nullif(session_messages.author_display_name, ''), left(session_messages.body, 60), session_messages.id::text),
      session_messages.deleted_at,
      session_messages.deleted_by,
      session_messages.delete_reason
    from public.session_messages
    where session_messages.deleted_at is not null
    union all
    select
      'club_members'::text,
      club_members.id,
      coalesce(nullif(club_members.display_name, ''), club_members.profile_id::text),
      club_members.deleted_at,
      club_members.deleted_by,
      club_members.delete_reason
    from public.club_members
    where club_members.deleted_at is not null
    union all
    select
      'tournament_pools'::text,
      tournament_pools.id,
      coalesce(nullif(tournament_pools.name, ''), tournament_pools.id::text),
      tournament_pools.deleted_at,
      tournament_pools.deleted_by,
      tournament_pools.delete_reason
    from public.tournament_pools
    where tournament_pools.deleted_at is not null
    union all
    select
      'tournament_pool_entries'::text,
      tournament_pool_entries.id,
      coalesce(tournament_pool_entries.profile_id::text, tournament_pool_entries.participant_id::text, tournament_pool_entries.id::text),
      tournament_pool_entries.deleted_at,
      tournament_pool_entries.deleted_by,
      tournament_pool_entries.delete_reason
    from public.tournament_pool_entries
    where tournament_pool_entries.deleted_at is not null
    union all
    select
      'tournament_matches'::text,
      tournament_matches.id,
      coalesce(tournament_matches.stage || ' #' || tournament_matches.match_number::text, tournament_matches.id::text),
      tournament_matches.deleted_at,
      tournament_matches.deleted_by,
      tournament_matches.delete_reason
    from public.tournament_matches
    where tournament_matches.deleted_at is not null
  ) rows
  left join public.profiles actor on actor.id = rows.deleted_by
  order by rows.deleted_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;


ALTER FUNCTION "public"."get_soft_deleted_records_v2"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_daily_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date" DEFAULT NULL::"date", "p_compare_end" "date" DEFAULT NULL::"date", "p_order_limit" integer DEFAULT 120) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_compare_start date := case
    when p_compare_start is null or p_compare_end is null then null
    else least(p_compare_start, p_compare_end)
  end;
  v_compare_end date := case
    when p_compare_start is null or p_compare_end is null then null
    else greatest(p_compare_start, p_compare_end)
  end;
  v_order_limit integer := least(greatest(coalesce(p_order_limit, 120), 0), 250);
  v_report jsonb;
  v_comparison_report jsonb;
  v_report_series jsonb;
  v_comparison_series jsonb;
  v_orders jsonb;
  v_payments jsonb;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with payment_totals as (
    select
      order_id,
      count(*)::integer as payment_count,
      coalesce(sum(amount), 0)::bigint as total_paid,
      coalesce(sum(amount) filter (where payment_method = 'cash'), 0)::bigint as cash_total,
      coalesce(sum(amount) filter (where payment_method = 'bank_transfer'), 0)::bigint as bank_transfer_total
    from public.staff_order_payments
    group by order_id
  ),
  scoped_orders as (
    select
      o.*,
      coalesce(p.payment_count, 0) as payment_count,
      coalesce(p.total_paid, 0) as split_paid_total,
      coalesce(p.cash_total, 0) as split_cash_total,
      coalesce(p.bank_transfer_total, 0) as split_bank_transfer_total
    from public.staff_orders o
    left join payment_totals p on p.order_id = o.id
    where o.booking_date between v_start and v_end
  ),
  totals as (
    select
      coalesce(sum(total), 0)::bigint as total_sales,
      coalesce(sum(case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end), 0)::bigint as total_paid,
      coalesce(sum(greatest(0, total - case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end)), 0)::bigint as unpaid_amount,
      coalesce(sum(case when payment_count > 0 then split_cash_total when payment_method = 'cash' then total else 0 end), 0)::bigint as cash_total,
      coalesce(sum(case when payment_count > 0 then split_bank_transfer_total when payment_method = 'bank_transfer' then total else 0 end), 0)::bigint as bank_transfer_total,
      count(*)::integer as bookings,
      coalesce(sum(players_count), 0)::integer as players,
      count(*) filter (where order_status = 'cancelled')::integer as cancelled,
      count(*) filter (where order_status = 'no_show')::integer as no_shows,
      coalesce(sum(discount_total), 0)::bigint as discounts
    from scoped_orders
  ),
  best_game as (
    select coalesce((
      select coalesce(g.name, 'Unknown')
      from scoped_orders so
      left join public.staff_games g on g.id = so.game_id
      group by coalesce(g.name, 'Unknown')
      order by count(*) desc, coalesce(g.name, 'Unknown') asc
      limit 1
    ), 'None yet') as best_selling_game
  )
  select jsonb_build_object(
    'totalSales', total_sales,
    'totalPaid', total_paid,
    'unpaidAmount', unpaid_amount,
    'cashTotal', cash_total,
    'bankTransferTotal', bank_transfer_total,
    'bookings', bookings,
    'players', players,
    'cancelled', cancelled,
    'noShows', no_shows,
    'discounts', discounts,
    'bestSellingGame', best_selling_game
  )
  into v_report
  from totals
  cross join best_game;

  with days as (
    select generate_series(v_start, least(v_end, v_start + 44), interval '1 day')::date as day
  ),
  daily as (
    select
      booking_date,
      coalesce(sum(total), 0)::bigint as sales,
      count(*)::integer as bookings,
      coalesce(sum(players_count), 0)::integer as players
    from public.staff_orders
    where booking_date between v_start and least(v_end, v_start + 44)
    group by booking_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', days.day::text,
    'sales', coalesce(daily.sales, 0),
    'bookings', coalesce(daily.bookings, 0),
    'players', coalesce(daily.players, 0)
  ) order by days.day), '[]'::jsonb)
  into v_report_series
  from days
  left join daily on daily.booking_date = days.day;

  if v_compare_start is null or v_compare_end is null then
    v_comparison_report := jsonb_build_object(
      'totalSales', 0,
      'totalPaid', 0,
      'unpaidAmount', 0,
      'cashTotal', 0,
      'bankTransferTotal', 0,
      'bookings', 0,
      'players', 0,
      'cancelled', 0,
      'noShows', 0,
      'discounts', 0,
      'bestSellingGame', 'None yet'
    );
    v_comparison_series := '[]'::jsonb;
  else
    with payment_totals as (
      select
        order_id,
        count(*)::integer as payment_count,
        coalesce(sum(amount), 0)::bigint as total_paid,
        coalesce(sum(amount) filter (where payment_method = 'cash'), 0)::bigint as cash_total,
        coalesce(sum(amount) filter (where payment_method = 'bank_transfer'), 0)::bigint as bank_transfer_total
      from public.staff_order_payments
      group by order_id
    ),
    scoped_orders as (
      select
        o.*,
        coalesce(p.payment_count, 0) as payment_count,
        coalesce(p.total_paid, 0) as split_paid_total,
        coalesce(p.cash_total, 0) as split_cash_total,
        coalesce(p.bank_transfer_total, 0) as split_bank_transfer_total
      from public.staff_orders o
      left join payment_totals p on p.order_id = o.id
      where o.booking_date between v_compare_start and v_compare_end
    ),
    totals as (
      select
        coalesce(sum(total), 0)::bigint as total_sales,
        coalesce(sum(case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end), 0)::bigint as total_paid,
        coalesce(sum(greatest(0, total - case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end)), 0)::bigint as unpaid_amount,
        coalesce(sum(case when payment_count > 0 then split_cash_total when payment_method = 'cash' then total else 0 end), 0)::bigint as cash_total,
        coalesce(sum(case when payment_count > 0 then split_bank_transfer_total when payment_method = 'bank_transfer' then total else 0 end), 0)::bigint as bank_transfer_total,
        count(*)::integer as bookings,
        coalesce(sum(players_count), 0)::integer as players,
        count(*) filter (where order_status = 'cancelled')::integer as cancelled,
        count(*) filter (where order_status = 'no_show')::integer as no_shows,
        coalesce(sum(discount_total), 0)::bigint as discounts
      from scoped_orders
    ),
    best_game as (
      select coalesce((
        select coalesce(g.name, 'Unknown')
        from scoped_orders so
        left join public.staff_games g on g.id = so.game_id
        group by coalesce(g.name, 'Unknown')
        order by count(*) desc, coalesce(g.name, 'Unknown') asc
        limit 1
      ), 'None yet') as best_selling_game
    )
    select jsonb_build_object(
      'totalSales', total_sales,
      'totalPaid', total_paid,
      'unpaidAmount', unpaid_amount,
      'cashTotal', cash_total,
      'bankTransferTotal', bank_transfer_total,
      'bookings', bookings,
      'players', players,
      'cancelled', cancelled,
      'noShows', no_shows,
      'discounts', discounts,
      'bestSellingGame', best_selling_game
    )
    into v_comparison_report
    from totals
    cross join best_game;

    with days as (
      select generate_series(v_compare_start, least(v_compare_end, v_compare_start + 44), interval '1 day')::date as day
    ),
    daily as (
      select
        booking_date,
        coalesce(sum(total), 0)::bigint as sales,
        count(*)::integer as bookings,
        coalesce(sum(players_count), 0)::integer as players
      from public.staff_orders
      where booking_date between v_compare_start and least(v_compare_end, v_compare_start + 44)
      group by booking_date
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', days.day::text,
      'sales', coalesce(daily.sales, 0),
      'bookings', coalesce(daily.bookings, 0),
      'players', coalesce(daily.players, 0)
    ) order by days.day), '[]'::jsonb)
    into v_comparison_series
    from days
    left join daily on daily.booking_date = days.day;
  end if;

  with selected_orders as (
    select *
    from public.staff_orders
    where booking_date between v_start and v_end
    order by booking_date desc, booking_time desc
    limit v_order_limit
  )
  select coalesce(jsonb_agg(to_jsonb(so) order by so.booking_date desc, so.booking_time desc), '[]'::jsonb)
  into v_orders
  from selected_orders so;

  with selected_orders as (
    select id
    from public.staff_orders
    where booking_date between v_start and v_end
    order by booking_date desc, booking_time desc
    limit v_order_limit
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb)
  into v_payments
  from public.staff_order_payments p
  where p.order_id in (select id from selected_orders);

  return jsonb_build_object(
    'report', coalesce(v_report, '{}'::jsonb),
    'comparisonReport', coalesce(v_comparison_report, '{}'::jsonb),
    'reportSeries', coalesce(v_report_series, '[]'::jsonb),
    'comparisonSeries', coalesce(v_comparison_series, '[]'::jsonb),
    'orders', coalesce(v_orders, '[]'::jsonb),
    'payments', coalesce(v_payments, '[]'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."get_staff_daily_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guest_ticket_phone_account_status"("p_guest_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null
    or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15
  then
    raise exception 'Enter a valid phone number.';
  end if;

  return jsonb_build_object(
    'normalized_phone', v_guest_phone,
    'has_account', false
  );
end;
$$;


ALTER FUNCTION "public"."guest_ticket_phone_account_status"("p_guest_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff_attendance_editor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier')
$$;


ALTER FUNCTION "public"."is_staff_attendance_editor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff_console_user"("p_min_rank" integer DEFAULT 20) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.is_staff_console_user(p_min_rank) $$;


ALTER FUNCTION "public"."is_staff_console_user"("p_min_rank" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_vrena_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.is_vrena_admin() $$;


ALTER FUNCTION "public"."is_vrena_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_vrena_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.is_vrena_owner() $$;


ALTER FUNCTION "public"."is_vrena_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_vrena_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_vrena_owner();
$$;


ALTER FUNCTION "public"."is_vrena_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_avatar_emoji" "text" DEFAULT NULL::"text", "p_avatar_initials" "text" DEFAULT NULL::"text", "p_avatar_color" "text" DEFAULT NULL::"text", "p_avatar_text_color" "text" DEFAULT NULL::"text", "p_profile_motto" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if char_length(coalesce(p_invite_code, '')) > 64 then
    raise exception 'Incorrect private session code.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt', 20, 600, 'private-code:actor-global'
  );
  perform public.consume_rate_limit(
    'booking_attempt',
    5,
    600,
    'private-code:session:' || coalesce(p_session_id::text, 'missing')
  );

  perform private.join_private_session_waitlist_with_code(
    p_session_id,
    p_invite_code,
    p_display_name,
    p_avatar_url,
    p_avatar_emoji,
    p_avatar_initials,
    p_avatar_color,
    p_avatar_text_color,
    p_profile_motto
  );
end;
$$;


ALTER FUNCTION "public"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_avatar_emoji" "text" DEFAULT NULL::"text", "p_avatar_initials" "text" DEFAULT NULL::"text", "p_avatar_color" "text" DEFAULT NULL::"text", "p_avatar_text_color" "text" DEFAULT NULL::"text", "p_profile_motto" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if char_length(coalesce(p_invite_code, '')) > 64 then
    raise exception 'Incorrect private session code.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt', 20, 600, 'private-code:actor-global'
  );
  perform public.consume_rate_limit(
    'booking_attempt',
    5,
    600,
    'private-code:session:' || coalesce(p_session_id::text, 'missing')
  );

  perform private.join_private_session_with_code(
    p_session_id,
    p_invite_code,
    p_display_name,
    p_avatar_url,
    p_avatar_emoji,
    p_avatar_initials,
    p_avatar_color,
    p_avatar_text_color,
    p_profile_motto
  );
end;
$$;


ALTER FUNCTION "public"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_tournament_audit"("p_session_id" "uuid", "p_action" "text", "p_old_value" "jsonb" DEFAULT NULL::"jsonb", "p_new_value" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_action text := btrim(coalesce(p_action, ''));
begin
  if v_actor is null
    or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
    or not public.can_manage_tournament(p_session_id)
  then
    raise exception 'Not authorized to write this tournament audit entry.';
  end if;

  if char_length(v_action) not between 1 and 120 then
    raise exception 'Tournament audit action must be between 1 and 120 characters.';
  end if;

  if pg_column_size(coalesce(p_old_value, 'null'::jsonb)) > 32768
    or pg_column_size(coalesce(p_new_value, 'null'::jsonb)) > 32768
  then
    raise exception 'Tournament audit values are too large.';
  end if;

  insert into public.tournament_audit_log (
    session_id,
    user_id,
    action,
    old_value,
    new_value
  ) values (
    p_session_id,
    v_actor,
    v_action,
    p_old_value,
    p_new_value
  );
end;
$$;


ALTER FUNCTION "public"."log_tournament_audit"("p_session_id" "uuid", "p_action" "text", "p_old_value" "jsonb", "p_new_value" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_guest_ticket_phone"("p_phone" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select regexp_replace(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '(?!^)\+', '', 'g')
$$;


ALTER FUNCTION "public"."normalize_guest_ticket_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_player_identity"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select nullif(lower(btrim(p_value)), '');
$$;


ALTER FUNCTION "public"."normalize_player_identity"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_google_sheets_session_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'extensions', 'net'
    AS $$
declare
  v_webhook_url text;
  v_webhook_secret text;
  v_event_type text;
  v_owner_name text;
  v_owner_email text;
  v_owner_phone text;
  v_owner_birthday date;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_birthday date;
  v_player_birthday date;
  v_player_age integer;
  v_minor_warning text;
  v_payload jsonb;
begin
  if coalesce(new.seeded, false) then
    return new;
  end if;

  select nullif(value, '')
    into v_webhook_url
  from private.integration_settings
  where key = 'google_sheets_webhook_url';

  if v_webhook_url is null then
    return new;
  end if;

  select coalesce(nullif(value, ''), '')
    into v_webhook_secret
  from private.integration_settings
  where key = 'google_sheets_webhook_secret';

  v_webhook_secret := coalesce(v_webhook_secret, '');

  v_event_type := case
    when new.booking_type = 'ticket' then 'ticket_booked'
    else 'session_created'
  end;

  select
    coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
    profiles.email,
    profiles.phone,
    profiles.birthday
  into v_owner_name, v_owner_email, v_owner_phone, v_owner_birthday
  from public.profiles
  where profiles.id = new.owner_id;

  if new.ticket_customer_id is not null then
    select
      coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
      profiles.email,
      profiles.phone,
      profiles.birthday
    into v_customer_name, v_customer_email, v_customer_phone, v_customer_birthday
    from public.profiles
    where profiles.id = new.ticket_customer_id;
  end if;

  v_player_birthday := coalesce(v_customer_birthday, v_owner_birthday);
  if v_player_birthday is not null then
    v_player_age := extract(year from age(current_date, v_player_birthday))::integer;
    if v_player_age < 13 then
      v_minor_warning := 'UNDER-13 PLAYER: Online booking/session creation should remain disabled. Staff must handle this manually with a parent/guardian.';
    elsif v_player_age < 18 then
      v_minor_warning := 'MINOR PLAYER: This user is under 18. Parent/guardian confirmation is required before confirming this booking/session.';
    end if;
  end if;

  v_payload := jsonb_build_object(
    'secret', v_webhook_secret,
    'source', 'supabase',
    'event_type', v_event_type,
    'created_at', now(),
    'app_url', 'https://booking.vre-vietnam.com',
    'minor_warning', v_minor_warning,
    'player_age', v_player_age,
    'session', jsonb_build_object(
      'id', new.id,
      'venue_key', new.venue_key,
      'booking_type', coalesce(new.booking_type, 'community'),
      'name', new.name,
      'date', new.date,
      'start_time', to_char(new.start_time, 'HH24:MI'),
      'duration_minutes', new.duration_minutes,
      'max_players', new.max_players,
      'arena_count', new.arena_count,
      'session_type', new.session_type,
      'visibility', new.visibility,
      'status', new.status,
      'game_options', coalesce(to_jsonb(new.game_options), '[]'::jsonb),
      'confirmed_game_id', new.confirmed_game_id,
      'invite_code', new.invite_code,
      'notes', new.notes,
      'ticket_type', new.ticket_type,
      'ticket_player_count', new.ticket_player_count,
      'ticket_unit_price', new.ticket_unit_price,
      'ticket_total_price', new.ticket_total_price,
      'ticket_status', new.ticket_status,
      'ticket_reference', new.ticket_reference,
      'ticket_customer_id', new.ticket_customer_id,
      'owner_id', new.owner_id
    ),
    'owner', jsonb_build_object(
      'id', new.owner_id,
      'name', coalesce(v_owner_name, 'Unknown'),
      'email', v_owner_email,
      'phone', v_owner_phone,
      'birthday', v_owner_birthday
    ),
    'customer', jsonb_build_object(
      'id', coalesce(new.ticket_customer_id, new.owner_id),
      'name', coalesce(v_customer_name, v_owner_name, 'Unknown'),
      'email', coalesce(v_customer_email, v_owner_email),
      'phone', coalesce(v_customer_phone, v_owner_phone),
      'birthday', coalesce(v_customer_birthday, v_owner_birthday)
    ),
    'raw_session', to_jsonb(new)
  );

  perform net.http_post(
    url := v_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    raise warning 'Google Sheets booking webhook failed for session %: %', new.id, sqlerrm;
    return new;
end;
$$;


ALTER FUNCTION "public"."notify_google_sheets_session_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_google_sheets_session_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'extensions', 'net'
    AS $$
declare
  v_webhook_url text;
  v_webhook_secret text;
  v_event_type text;
  v_owner_name text;
  v_owner_email text;
  v_owner_phone text;
  v_owner_birthday date;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_birthday date;
  v_player_birthday date;
  v_player_age integer;
  v_minor_warning text;
  v_changed_fields text[] := array[]::text[];
  v_is_ticket boolean;
  v_is_cancelled boolean;
  v_payload jsonb;
begin
  if coalesce(new.seeded, false) then
    return new;
  end if;

  if old.name is distinct from new.name then
    v_changed_fields := array_append(v_changed_fields, 'name');
  end if;
  if old.date is distinct from new.date then
    v_changed_fields := array_append(v_changed_fields, 'date');
  end if;
  if old.start_time is distinct from new.start_time then
    v_changed_fields := array_append(v_changed_fields, 'start_time');
  end if;
  if old.duration_minutes is distinct from new.duration_minutes then
    v_changed_fields := array_append(v_changed_fields, 'duration_minutes');
  end if;
  if old.max_players is distinct from new.max_players then
    v_changed_fields := array_append(v_changed_fields, 'max_players');
  end if;
  if old.arena_count is distinct from new.arena_count then
    v_changed_fields := array_append(v_changed_fields, 'arena_count');
  end if;
  if old.session_type is distinct from new.session_type then
    v_changed_fields := array_append(v_changed_fields, 'session_type');
  end if;
  if old.visibility is distinct from new.visibility then
    v_changed_fields := array_append(v_changed_fields, 'visibility');
  end if;
  if old.status is distinct from new.status then
    v_changed_fields := array_append(v_changed_fields, 'status');
  end if;
  if old.game_options is distinct from new.game_options then
    v_changed_fields := array_append(v_changed_fields, 'game_options');
  end if;
  if old.confirmed_game_id is distinct from new.confirmed_game_id then
    v_changed_fields := array_append(v_changed_fields, 'confirmed_game_id');
  end if;
  if old.invite_code is distinct from new.invite_code then
    v_changed_fields := array_append(v_changed_fields, 'invite_code');
  end if;
  if old.notes is distinct from new.notes then
    v_changed_fields := array_append(v_changed_fields, 'notes');
  end if;
  if old.booking_type is distinct from new.booking_type then
    v_changed_fields := array_append(v_changed_fields, 'booking_type');
  end if;
  if old.ticket_type is distinct from new.ticket_type then
    v_changed_fields := array_append(v_changed_fields, 'ticket_type');
  end if;
  if old.ticket_player_count is distinct from new.ticket_player_count then
    v_changed_fields := array_append(v_changed_fields, 'ticket_player_count');
  end if;
  if old.ticket_unit_price is distinct from new.ticket_unit_price then
    v_changed_fields := array_append(v_changed_fields, 'ticket_unit_price');
  end if;
  if old.ticket_total_price is distinct from new.ticket_total_price then
    v_changed_fields := array_append(v_changed_fields, 'ticket_total_price');
  end if;
  if old.ticket_status is distinct from new.ticket_status then
    v_changed_fields := array_append(v_changed_fields, 'ticket_status');
  end if;
  if old.ticket_reference is distinct from new.ticket_reference then
    v_changed_fields := array_append(v_changed_fields, 'ticket_reference');
  end if;
  if old.ticket_customer_id is distinct from new.ticket_customer_id then
    v_changed_fields := array_append(v_changed_fields, 'ticket_customer_id');
  end if;
  if old.owner_id is distinct from new.owner_id then
    v_changed_fields := array_append(v_changed_fields, 'owner_id');
  end if;

  if coalesce(array_length(v_changed_fields, 1), 0) = 0 then
    return new;
  end if;

  select nullif(value, '')
    into v_webhook_url
  from private.integration_settings
  where key = 'google_sheets_webhook_url';

  if v_webhook_url is null then
    return new;
  end if;

  select coalesce(nullif(value, ''), '')
    into v_webhook_secret
  from private.integration_settings
  where key = 'google_sheets_webhook_secret';

  v_webhook_secret := coalesce(v_webhook_secret, '');
  v_is_ticket := coalesce(new.booking_type, 'community') = 'ticket';
  v_is_cancelled := (
    new.status = 'cancelled'
    and old.status is distinct from new.status
  ) or (
    new.ticket_status = 'cancelled'
    and old.ticket_status is distinct from new.ticket_status
  );

  v_event_type := case
    when v_is_ticket and v_is_cancelled then 'ticket_cancelled'
    when v_is_ticket then 'ticket_updated'
    when v_is_cancelled then 'session_cancelled'
    else 'session_updated'
  end;

  select
    coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
    profiles.email,
    profiles.phone,
    profiles.birthday
  into v_owner_name, v_owner_email, v_owner_phone, v_owner_birthday
  from public.profiles
  where profiles.id = new.owner_id;

  if new.ticket_customer_id is not null then
    select
      coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
      profiles.email,
      profiles.phone,
      profiles.birthday
    into v_customer_name, v_customer_email, v_customer_phone, v_customer_birthday
    from public.profiles
    where profiles.id = new.ticket_customer_id;
  end if;

  v_player_birthday := coalesce(v_customer_birthday, v_owner_birthday);
  if v_player_birthday is not null then
    v_player_age := extract(year from age(current_date, v_player_birthday))::integer;
    if v_player_age < 13 then
      v_minor_warning := 'UNDER-13 PLAYER: Online booking/session creation should remain disabled. Staff must handle this manually with a parent/guardian.';
    elsif v_player_age < 18 then
      v_minor_warning := 'MINOR PLAYER: This user is under 18. Parent/guardian confirmation is required before confirming this booking/session.';
    end if;
  end if;

  v_payload := jsonb_build_object(
    'secret', v_webhook_secret,
    'source', 'supabase',
    'event_type', v_event_type,
    'created_at', now(),
    'app_url', 'https://booking.vre-vietnam.com',
    'minor_warning', v_minor_warning,
    'player_age', v_player_age,
    'changed_fields', to_jsonb(v_changed_fields),
    'session', jsonb_build_object(
      'id', new.id,
      'venue_key', new.venue_key,
      'booking_type', coalesce(new.booking_type, 'community'),
      'name', new.name,
      'date', new.date,
      'start_time', to_char(new.start_time, 'HH24:MI'),
      'duration_minutes', new.duration_minutes,
      'max_players', new.max_players,
      'arena_count', new.arena_count,
      'session_type', new.session_type,
      'visibility', new.visibility,
      'status', new.status,
      'game_options', coalesce(to_jsonb(new.game_options), '[]'::jsonb),
      'confirmed_game_id', new.confirmed_game_id,
      'invite_code', new.invite_code,
      'notes', new.notes,
      'ticket_type', new.ticket_type,
      'ticket_player_count', new.ticket_player_count,
      'ticket_unit_price', new.ticket_unit_price,
      'ticket_total_price', new.ticket_total_price,
      'ticket_status', new.ticket_status,
      'ticket_reference', new.ticket_reference,
      'ticket_customer_id', new.ticket_customer_id,
      'owner_id', new.owner_id
    ),
    'previous_session', jsonb_build_object(
      'id', old.id,
      'venue_key', old.venue_key,
      'booking_type', coalesce(old.booking_type, 'community'),
      'name', old.name,
      'date', old.date,
      'start_time', to_char(old.start_time, 'HH24:MI'),
      'duration_minutes', old.duration_minutes,
      'max_players', old.max_players,
      'arena_count', old.arena_count,
      'session_type', old.session_type,
      'visibility', old.visibility,
      'status', old.status,
      'game_options', coalesce(to_jsonb(old.game_options), '[]'::jsonb),
      'confirmed_game_id', old.confirmed_game_id,
      'invite_code', old.invite_code,
      'notes', old.notes,
      'ticket_type', old.ticket_type,
      'ticket_player_count', old.ticket_player_count,
      'ticket_unit_price', old.ticket_unit_price,
      'ticket_total_price', old.ticket_total_price,
      'ticket_status', old.ticket_status,
      'ticket_reference', old.ticket_reference,
      'ticket_customer_id', old.ticket_customer_id,
      'owner_id', old.owner_id
    ),
    'owner', jsonb_build_object(
      'id', new.owner_id,
      'name', coalesce(v_owner_name, 'Unknown'),
      'email', v_owner_email,
      'phone', v_owner_phone,
      'birthday', v_owner_birthday
    ),
    'customer', jsonb_build_object(
      'id', coalesce(new.ticket_customer_id, new.owner_id),
      'name', coalesce(v_customer_name, v_owner_name, 'Unknown'),
      'email', coalesce(v_customer_email, v_owner_email),
      'phone', coalesce(v_customer_phone, v_owner_phone),
      'birthday', coalesce(v_customer_birthday, v_owner_birthday)
    ),
    'raw_session', to_jsonb(new),
    'previous_raw_session', to_jsonb(old)
  );

  perform net.http_post(
    url := v_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    raise warning 'Google Sheets booking update webhook failed for session %: %', new.id, sqlerrm;
    return new;
end;
$$;


ALTER FUNCTION "public"."notify_google_sheets_session_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_tournament"("target_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ select private.owns_tournament(target_session_id) $$;


ALTER FUNCTION "public"."owns_tournament"("target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_achievement_awards_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."profile_achievement_awards_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_achievement_unlock_views_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."profile_achievement_unlock_views_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_anonymous_callsign"("p_profile_id" "uuid") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select (array['ECHO', 'NOVA', 'ORION', 'CIPHER', 'PHANTOM', 'VORTEX', 'NEON', 'PULSE'])[
      (abs(hashtext(coalesce(p_profile_id::text, 'private-player'))::bigint) % 8) + 1
    ]
    || '-'
    || lpad(((abs(hashtext(coalesce(p_profile_id::text, 'private-player'))::bigint) % 900) + 100)::text, 3, '0');
$$;


ALTER FUNCTION "public"."profile_anonymous_callsign"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_has_account"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from auth.users users
    where users.id = p_profile_id
      and coalesce((users.raw_app_meta_data->>'guest_ticket')::boolean, false) is not true
  )
$$;


ALTER FUNCTION "public"."profile_has_account"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_public_display_name"("p_profile_id" "uuid", "p_nickname" "text", "p_full_name" "text", "p_phone" "text", "p_anonymous_mode" boolean, "p_anonymous_callsign" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."profile_public_display_name"("p_profile_id" "uuid", "p_nickname" "text", "p_full_name" "text", "p_phone" "text", "p_anonymous_mode" boolean, "p_anonymous_callsign" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_search"("p_search" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_role" "text" DEFAULT NULL::"text", "p_include_demo" boolean DEFAULT false, "p_sort" "text" DEFAULT 'name_asc'::"text") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "full_name" "text", "nickname" "text", "email" "text", "phone" "text", "role" "text", "loyalty_points_total" integer, "is_seed_demo" boolean, "seed_batch" "text", "total_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_sort text := coalesce(nullif(p_sort, ''), 'name_asc');
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  return query
  with filtered_profiles as (
    select
      p.id,
      p.created_at,
      p.full_name,
      p.nickname,
      p.email,
      p.phone,
      p.role,
      p.loyalty_points_total,
      coalesce(p.is_seed_demo, false) as is_seed_demo,
      p.seed_batch,
      coalesce(nullif(p.nickname, ''), nullif(p.full_name, ''), nullif(p.email, ''), nullif(p.phone, ''), 'Player') as sort_name,
      public.staff_role_rank(p.role, p.email) as role_rank
    from public.profiles p
    where p.deleted_at is null
      and (p_include_demo or not coalesce(p.is_seed_demo, false))
      and (
        v_role is null
        or v_role = 'all'
        or lower(coalesce(p.role, 'player')) = v_role
        or (v_role = 'owner' and public.staff_role_rank(p.role, p.email) >= 120)
        or (v_role = 'admin' and public.staff_role_rank(p.role, p.email) = 100)
      )
      and (
        v_search is null
        or lower(coalesce(p.full_name, '') || ' ' || coalesce(p.nickname, '') || ' ' || coalesce(p.email, '') || ' ' || coalesce(p.phone, '')) like '%' || v_search || '%'
      )
  ),
  counted_profiles as (
    select
      filtered_profiles.*,
      count(*) over ()::integer as total_count
    from filtered_profiles
  )
  select
    counted_profiles.id,
    counted_profiles.created_at,
    counted_profiles.full_name,
    counted_profiles.nickname,
    counted_profiles.email,
    counted_profiles.phone,
    counted_profiles.role,
    counted_profiles.loyalty_points_total,
    counted_profiles.is_seed_demo,
    counted_profiles.seed_batch,
    counted_profiles.total_count
  from counted_profiles
  order by
    case when v_sort = 'created_desc' then counted_profiles.created_at end desc nulls last,
    case when v_sort = 'role_desc' then counted_profiles.role_rank end desc nulls last,
    case when v_sort = 'role_asc' then counted_profiles.role_rank end asc nulls last,
    case when v_sort = 'name_desc' then lower(counted_profiles.sort_name) end desc nulls last,
    case when v_sort = 'email_asc' then lower(coalesce(counted_profiles.email, '')) end asc nulls last,
    lower(counted_profiles.sort_name) asc,
    lower(coalesce(counted_profiles.email, '')) asc,
    counted_profiles.id asc
  limit v_limit
  offset v_offset;
end;
$$;


ALTER FUNCTION "public"."profile_search"("p_search" "text", "p_limit" integer, "p_offset" integer, "p_role" "text", "p_include_demo" boolean, "p_sort" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_session_waitlist"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    perform public.promote_session_waitlist_internal(p_session_id);
    return;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  if not public.can_manage_session_row(p_session_id) then
    raise exception 'Session manager access required.';
  end if;

  perform public.promote_session_waitlist_internal(p_session_id);
end;
$$;


ALTER FUNCTION "public"."promote_session_waitlist"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_session_waitlist_internal"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session public.sessions%rowtype;
  v_waitlist public.session_waitlist%rowtype;
  v_participant_count integer;
begin
  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and status <> 'cancelled'
    and deleted_at is null
  for update;

  if not found then
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.session_participants
  where session_id = p_session_id
    and deleted_at is null;

  if v_participant_count >= v_session.max_players then
    return;
  end if;

  select *
  into v_waitlist
  from public.session_waitlist
  where session_id = p_session_id
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.session_participants
    where session_id = p_session_id
      and profile_id = v_waitlist.profile_id
      and deleted_at is null
  ) then
    insert into public.session_participants (
      session_id,
      profile_id,
      display_name,
      avatar_url,
      avatar_emoji,
      avatar_initials,
      avatar_color,
      avatar_text_color,
      profile_motto
    ) values (
      v_waitlist.session_id,
      v_waitlist.profile_id,
      v_waitlist.display_name,
      v_waitlist.avatar_url,
      v_waitlist.avatar_emoji,
      v_waitlist.avatar_initials,
      v_waitlist.avatar_color,
      v_waitlist.avatar_text_color,
      v_waitlist.profile_motto
    );
  end if;

  delete from public.session_waitlist where id = v_waitlist.id;
end;
$$;


ALTER FUNCTION "public"."promote_session_waitlist_internal"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_waitlist_after_participant_departure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.promote_session_waitlist_internal(old.session_id);

  if tg_op = 'UPDATE' then
    return new;
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."promote_waitlist_after_participant_departure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_minor_birthday_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if new.birthday is distinct from old.birthday
    and old.birthday is not null
    and old.birthday > (current_date - interval '18 years')::date
    and auth.uid() = old.id
  then
    raise exception using
      errcode = 'P0001',
      message = 'A child''s date of birth can only be changed by the VRena team.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_minor_birthday_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."protect_minor_birthday_change"() IS 'Prevents a logged-in minor from changing their own saved birthday; trusted VRena staff service flows remain available for corrections.';



CREATE OR REPLACE FUNCTION "public"."protect_profile_loyalty_points_total"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.loyalty_points_total is distinct from new.loyalty_points_total
    and coalesce(current_setting('app.loyalty_internal_update', true), '') <> 'allowed'
    and current_user <> 'service_role'
    and not public.is_staff_console_user(50)
  then
    raise exception 'Staff access required to edit loyalty points.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profile_loyalty_points_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_new_role text := lower(nullif(btrim(coalesce(new.role, 'player')), ''));
  v_old_role text := case
    when tg_op = 'UPDATE' then lower(nullif(btrim(coalesce(old.role, 'player')), ''))
    else null
  end;
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_is_hr_record_only boolean := coalesce(new.is_hr_record_only, false);
  v_is_shared_kiosk boolean := lower(coalesce(new.email, '')) = 'contact@vre-vietnam.com';
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

  if v_is_hr_record_only then
    new.role := 'employee';
    return new;
  end if;

  if v_is_shared_kiosk then
    new.role := 'employee';
    return new;
  end if;

  -- The Employee role is no longer assignable to normal web accounts. Ignore
  -- spoofed signup metadata and reject later attempts to restore the old role.
  if v_new_role = 'employee' then
    if tg_op = 'INSERT' then
      new.role := 'player';
      return new;
    end if;
    raise exception 'Employee PIN access is reserved for the shared store account.';
  end if;

  if tg_op = 'INSERT' then
    if v_new_role <> 'player' and not v_is_service_role and v_actor_rank < 100 then
      new.role := 'player';
    else
      new.role := v_new_role;
    end if;
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


ALTER FUNCTION "public"."protect_profile_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_sensitive_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_auth_email text := nullif(lower(auth.jwt() ->> 'email'), '');
  v_is_legacy_employee_downgrade boolean := false;
begin
  if v_is_service_role
    or coalesce(current_setting('app.loyalty_internal_update', true), '') = 'allowed'
  then
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


ALTER FUNCTION "public"."protect_profile_sensitive_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_session_client_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_can_manage boolean := public.can_manage_session_row(old.id);
  v_ticket_trusted_change boolean := false;
begin
  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  if old.booking_type = 'ticket' then
    v_ticket_trusted_change :=
      new.owner_id is distinct from old.owner_id
      or new.club_id is distinct from old.club_id
      or new.session_type is distinct from old.session_type
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.duration_minutes is distinct from old.duration_minutes
      or new.max_players is distinct from old.max_players
      or new.arena_count is distinct from old.arena_count
      or new.status is distinct from old.status
      or new.require_payment is distinct from old.require_payment
      or new.booking_type is distinct from old.booking_type
      or new.ticket_type is distinct from old.ticket_type
      or new.ticket_player_count is distinct from old.ticket_player_count
      or new.ticket_total_price is distinct from old.ticket_total_price
      or new.ticket_unit_price is distinct from old.ticket_unit_price
      or new.ticket_status is distinct from old.ticket_status
      or new.ticket_reference is distinct from old.ticket_reference
      or new.ticket_customer_id is distinct from old.ticket_customer_id
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.delete_reason is distinct from old.delete_reason;

    if v_ticket_trusted_change then
      raise exception 'Ticket booking payment and status fields can only be changed by staff.';
    end if;
  end if;

  if v_can_manage then
    return new;
  end if;

  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if not exists (
    select 1
    from public.session_participants sp
    where sp.session_id = old.id
      and sp.profile_id = v_actor
      and sp.deleted_at is null
  ) then
    raise exception 'Session participant access required.';
  end if;

  if new.game_votes is distinct from old.game_votes
    and new.owner_id is not distinct from old.owner_id
    and new.club_id is not distinct from old.club_id
    and new.session_type is not distinct from old.session_type
    and new.name is not distinct from old.name
    and new.date is not distinct from old.date
    and new.start_time is not distinct from old.start_time
    and new.duration_minutes is not distinct from old.duration_minutes
    and new.max_players is not distinct from old.max_players
    and new.arena_count is not distinct from old.arena_count
    and new.confirmed_game_id is not distinct from old.confirmed_game_id
    and new.visibility is not distinct from old.visibility
    and new.invite_code is not distinct from old.invite_code
    and new.notes is not distinct from old.notes
    and new.status is not distinct from old.status
    and new.tournament_format is not distinct from old.tournament_format
    and new.best_of is not distinct from old.best_of
    and new.rounds_per_match is not distinct from old.rounds_per_match
    and new.require_payment is not distinct from old.require_payment
    and new.qualification_rule is not distinct from old.qualification_rule
    and new.custom_qualifiers is not distinct from old.custom_qualifiers
    and new.enable_third_place_match is not distinct from old.enable_third_place_match
    and new.first_prize is not distinct from old.first_prize
    and new.second_prize is not distinct from old.second_prize
    and new.third_prize is not distinct from old.third_prize
    and new.tournament_locked is not distinct from old.tournament_locked
    and new.seeded is not distinct from old.seeded
    and new.seed_label is not distinct from old.seed_label
    and new.seed_batch is not distinct from old.seed_batch
    and new.booking_type is not distinct from old.booking_type
    and new.ticket_type is not distinct from old.ticket_type
    and new.ticket_player_count is not distinct from old.ticket_player_count
    and new.ticket_total_price is not distinct from old.ticket_total_price
    and new.ticket_unit_price is not distinct from old.ticket_unit_price
    and new.ticket_status is not distinct from old.ticket_status
    and new.ticket_reference is not distinct from old.ticket_reference
    and new.ticket_customer_id is not distinct from old.ticket_customer_id
    and new.challenge_target_id is not distinct from old.challenge_target_id
    and new.challenge_status is not distinct from old.challenge_status
    and new.challenge_accepted_at is not distinct from old.challenge_accepted_at
    and new.challenge_declined_at is not distinct from old.challenge_declined_at
    and new.deleted_at is not distinct from old.deleted_at
    and new.deleted_by is not distinct from old.deleted_by
    and new.delete_reason is not distinct from old.delete_reason
  then
    return new;
  end if;

  raise exception 'Only session managers can update this session field.';
end;
$$;


ALTER FUNCTION "public"."protect_session_client_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_session_participant_trusted_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_session record;
  v_trusted_payment_or_check_present boolean := false;
  v_trusted_payment_or_check_changed boolean := false;
  v_result_changed boolean := false;
  v_allowed_ticket_quote_insert boolean := false;
begin
  select
    s.id,
    s.owner_id,
    s.booking_type,
    s.ticket_customer_id,
    s.ticket_total_price
  into v_session
  from public.sessions s
  where s.id = new.session_id;

  if not found then
    raise exception 'Session not found.';
  end if;

  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_trusted_payment_or_check_present :=
      coalesce(new.checked_in, false) <> false
      or new.payment_status is not null
      or new.payment_amount is not null
      or coalesce(new.payment_splits, '[]'::jsonb) <> '[]'::jsonb
      or new.checked_in_at is not null;

    if not v_trusted_payment_or_check_present then
      return new;
    end if;

    v_allowed_ticket_quote_insert :=
      v_session.booking_type = 'ticket'
      and new.profile_id = v_session.ticket_customer_id
      and (
        new.profile_id = v_actor
        or (
          v_actor is null
          and v_session.owner_id = v_session.ticket_customer_id
        )
      )
      and coalesce(new.checked_in, false) = false
      and new.payment_status is null
      and new.payment_amount is not distinct from v_session.ticket_total_price
      and coalesce(new.payment_splits, '[]'::jsonb) = '[]'::jsonb
      and new.checked_in_at is null;

    if v_allowed_ticket_quote_insert then
      return new;
    end if;

    if v_session.booking_type <> 'ticket'
      and public.can_manage_session_row(new.session_id)
    then
      return new;
    end if;

    raise exception 'Only session managers can set participant payment or check-in fields.';
  end if;

  v_trusted_payment_or_check_changed :=
    new.checked_in is distinct from old.checked_in
    or new.payment_status is distinct from old.payment_status
    or new.payment_amount is distinct from old.payment_amount
    or coalesce(new.payment_splits, '[]'::jsonb) is distinct from coalesce(old.payment_splits, '[]'::jsonb)
    or new.checked_in_at is distinct from old.checked_in_at;

  v_result_changed :=
    new.score is distinct from old.score
    or new.accuracy_percent is distinct from old.accuracy_percent
    or new.hits is distinct from old.hits
    or new.movement_meters is distinct from old.movement_meters
    or new.projectiles_fired is distinct from old.projectiles_fired
    or new.escape_duration_seconds is distinct from old.escape_duration_seconds
    or new.placement is distinct from old.placement
    or new.prize_claimed is distinct from old.prize_claimed
    or new.prize_claimed_at is distinct from old.prize_claimed_at;

  if not v_trusted_payment_or_check_changed and not v_result_changed then
    return new;
  end if;

  if v_session.booking_type = 'ticket' then
    raise exception 'Ticket participant payment, check-in, and result fields can only be changed by staff.';
  end if;

  if public.can_manage_session_row(new.session_id) then
    return new;
  end if;

  raise exception 'Only session managers can update participant payment, check-in, or result fields.';
end;
$$;


ALTER FUNCTION "public"."protect_session_participant_trusted_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_ticket_session_boundary"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_ticket_field_changed boolean;
  v_ticket_operational_field_changed boolean;
begin
  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  v_ticket_field_changed :=
    new.booking_type is distinct from old.booking_type
    or new.ticket_type is distinct from old.ticket_type
    or new.ticket_player_count is distinct from old.ticket_player_count
    or new.ticket_total_price is distinct from old.ticket_total_price
    or new.ticket_unit_price is distinct from old.ticket_unit_price
    or new.ticket_status is distinct from old.ticket_status
    or new.ticket_reference is distinct from old.ticket_reference
    or new.ticket_customer_id is distinct from old.ticket_customer_id;

  v_ticket_operational_field_changed :=
    (old.booking_type = 'ticket' or new.booking_type = 'ticket')
    and (
      new.owner_id is distinct from old.owner_id
      or new.club_id is distinct from old.club_id
      or new.session_type is distinct from old.session_type
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.duration_minutes is distinct from old.duration_minutes
      or new.max_players is distinct from old.max_players
      or new.arena_count is distinct from old.arena_count
      or new.status is distinct from old.status
      or new.require_payment is distinct from old.require_payment
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.delete_reason is distinct from old.delete_reason
    );

  if v_ticket_field_changed or v_ticket_operational_field_changed then
    raise exception 'Ticket booking fields can only be changed by staff.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_ticket_session_boundary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_profile_search"("p_search" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "full_name" "text", "nickname" "text", "avatar_url" "text", "avatar_emoji" "text", "avatar_initials" "text", "avatar_color" "text", "avatar_text_color" "text", "profile_motto" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."public_profile_search"("p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_session_body"("p_name" "text", "p_date" "date", "p_start" time without time zone) RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select concat(
    coalesce(nullif(btrim(p_name), ''), 'VRena session'),
    ' · ',
    to_char(p_date, 'Mon DD'),
    ' ',
    to_char(p_start, 'HH24:MI')
  );
$$;


ALTER FUNCTION "public"."push_session_body"("p_name" "text", "p_date" "date", "p_start" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rate_limit_session_creates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if (select auth.uid()) is null then
    if new.booking_type = 'ticket'
      and new.ticket_customer_id is not null
      and new.owner_id = new.ticket_customer_id
      and nullif(btrim(coalesce(new.ticket_reference, '')), '') is not null
      and new.visibility = 'private'
      and (
        new.ticket_status = 'confirmed'
        or (
          new.ticket_status = 'pending'
          and new.venue_key = 'cafe-des-stagiaires'
          and new.ticket_reference ~ '^CS-[0-9]{6}-[A-Z0-9]{6}$'
          and current_setting('app.cafe_booking_request', true) = '1'
        )
      )
    then
      return new;
    end if;

    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt',
    3,
    60,
    'session:' || coalesce(new.date::text, 'unknown-date') || ':' || coalesce(new.start_time::text, 'unknown-time')
  );

  return new;
end;
$_$;


ALTER FUNCTION "public"."rate_limit_session_creates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rate_limit_session_invites"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'invite_player',
    10,
    300,
    coalesce(new.session_id::text, 'unknown-session')
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."rate_limit_session_invites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rate_limit_staff_config_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'staff_config_write',
    20,
    600,
    tg_table_name
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."rate_limit_staff_config_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_member_count"("target_club_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.clubs
  set member_count = coalesce((
    select count(*)::integer
    from public.club_members
    where club_members.club_id = target_club_id
      and club_members.status = 'approved'
      and club_members.deleted_at is null
  ), 0)
  where clubs.id = target_club_id;
$$;


ALTER FUNCTION "public"."refresh_club_member_count"("target_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_member_count_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_club_member_count(old.club_id);
    return old;
  end if;

  perform public.refresh_club_member_count(new.club_id);

  if tg_op = 'UPDATE' and old.club_id is distinct from new.club_id then
    perform public.refresh_club_member_count(old.club_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."refresh_club_member_count_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_soft_deleted_record"("p_entity_table" "text", "p_entity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_actor uuid := (select auth.uid());
  v_table text := lower(nullif(btrim(coalesce(p_entity_table, '')), ''));
  v_count integer := 0;
begin
  if v_actor is null or not public.is_vrena_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  if v_table not in ('profiles', 'sessions', 'session_participants', 'session_messages', 'club_members', 'tournament_pools', 'tournament_pool_entries', 'tournament_matches') then
    raise exception 'Unsupported restore table.';
  end if;

  execute format(
    'update public.%I set deleted_at = null, deleted_by = null, delete_reason = null where id = $1 and deleted_at is not null',
    v_table
  )
  using p_entity_id;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No deleted record found to restore.';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id)
  values (v_actor, 'restored_soft_deleted', v_table, p_entity_id);

  return jsonb_build_object('restored', true, 'entity_table', v_table, 'entity_id', p_entity_id);
end;
$_$;


ALTER FUNCTION "public"."restore_soft_deleted_record"("p_entity_table" "text", "p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_consume_venue_support_bundle_token"("p_bundle_id" "uuid", "p_token_digest" "text") RETURNS TABLE("storage_path" "text", "file_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  return query
  with consumed as (
    update public.venue_support_bundle_download_tokens token
    set used_at = now()
    where token.bundle_id = p_bundle_id
      and token.token_digest = lower(p_token_digest)
      and token.used_at is null
      and token.expires_at > now()
    returning token.bundle_id
  )
  select bundle.storage_path, bundle.file_name
  from consumed
  join public.venue_support_bundles bundle
    on bundle.id = consumed.bundle_id;
end;
$$;


ALTER FUNCTION "public"."service_consume_venue_support_bundle_token"("p_bundle_id" "uuid", "p_token_digest" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_matched_session_id" "uuid" DEFAULT NULL::"uuid", "p_matched_participant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select public.service_ingest_venue_game_result(
    p_profile_id => p_profile_id,
    p_player_name => p_player_name,
    p_game_name => p_game_name,
    p_game_slug => p_game_slug,
    p_score => p_score,
    p_hits => p_hits,
    p_accuracy_percent => p_accuracy_percent,
    p_movement_meters => p_movement_meters,
    p_external_session_label => p_external_session_label,
    p_captured_at => p_captured_at,
    p_source_capture_id => p_source_capture_id,
    p_source_device => p_source_device,
    p_match_status => p_match_status,
    p_venue_key => 'ha-do-centrosa',
    p_matched_session_id => p_matched_session_id,
    p_matched_participant_id => p_matched_participant_id
  );
$$;


ALTER FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_matched_session_id" "uuid", "p_matched_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_venue_key" "text", "p_matched_session_id" "uuid" DEFAULT NULL::"uuid", "p_matched_participant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  v_result_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if coalesce(p_venue_key, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Valid venue scope required.';
  end if;

  if p_matched_session_id is not null then
    perform 1 from public.sessions
    where id = p_matched_session_id
      and venue_key = p_venue_key
      and deleted_at is null;
    if not found then
      raise exception 'Matched session is outside the authenticated venue.';
    end if;
  end if;

  insert into public.venue_game_results (
    venue_key, profile_id, matched_session_id, matched_participant_id,
    player_name, game_name, game_slug, score, hits, accuracy_percent,
    movement_meters, external_session_label, captured_at, source_capture_id,
    source_device, match_status
  ) values (
    p_venue_key, p_profile_id, p_matched_session_id, p_matched_participant_id,
    p_player_name, p_game_name, p_game_slug, p_score, p_hits,
    p_accuracy_percent, p_movement_meters, p_external_session_label,
    p_captured_at, p_source_capture_id, p_source_device, p_match_status
  )
  on conflict do nothing
  returning id into v_result_id;

  if v_result_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if p_matched_participant_id is not null then
    update public.session_participants
    set score = p_score,
        accuracy_percent = p_accuracy_percent,
        hits = p_hits,
        movement_meters = p_movement_meters,
        updated_at = now()
    where id = p_matched_participant_id
      and session_id = p_matched_session_id
      and profile_id = p_profile_id
      and deleted_at is null;
    if not found then
      raise exception 'Matched participant is no longer available.';
    end if;
  end if;

  return jsonb_build_object('id', v_result_id, 'status', 'saved');
end;
$_$;


ALTER FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_venue_key" "text", "p_matched_session_id" "uuid", "p_matched_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_profile_nickname_available"("p_nickname" "text", "p_exclude_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select public.normalize_player_identity(p_nickname) is not null
    and not exists (
      select 1
      from public.profiles
      where profiles.deleted_at is null
        and not coalesce(profiles.is_hr_record_only, false)
        and profiles.id is distinct from p_exclude_id
        and public.normalize_player_identity(profiles.nickname)
          = public.normalize_player_identity(p_nickname)
    );
$$;


ALTER FUNCTION "public"."service_profile_nickname_available"("p_nickname" "text", "p_exclude_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."service_profile_nickname_available"("p_nickname" "text", "p_exclude_id" "uuid") IS 'Service-role preflight for active player nickname uniqueness.';



CREATE OR REPLACE FUNCTION "public"."service_profiles_for_venue_identity"("p_player_name" "text") RETURNS TABLE("id" "uuid", "full_name" "text", "nickname" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_identity text := public.normalize_player_identity(p_player_name);
  v_folded_identity text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if v_identity is null then
    return;
  end if;

  v_folded_identity := nullif(lower(extensions.unaccent(v_identity)), '');

  return query
    select profiles.id, profiles.full_name, profiles.nickname
    from public.profiles
    where profiles.deleted_at is null
      and (
        public.normalize_player_identity(profiles.full_name) = v_identity
        or public.normalize_player_identity(profiles.nickname) = v_identity
        or lower(extensions.unaccent(btrim(profiles.full_name))) = v_folded_identity
        or lower(extensions.unaccent(btrim(profiles.nickname))) = v_folded_identity
      )
    order by
      case
        when public.normalize_player_identity(profiles.full_name) = v_identity
          or public.normalize_player_identity(profiles.nickname) = v_identity
        then 0
        else 1
      end,
      profiles.id
    limit 2;
end;
$$;


ALTER FUNCTION "public"."service_profiles_for_venue_identity"("p_player_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."service_profiles_for_venue_identity"("p_player_name" "text") IS 'Service-only player lookup using exact identity first and accent-folded equality as an OCR fallback.';



CREATE OR REPLACE FUNCTION "public"."service_release_venue_upload"("p_reservation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  delete from private.venue_upload_reservations where id = p_reservation_id;
end;
$$;


ALTER FUNCTION "public"."service_release_venue_upload"("p_reservation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_reserve_venue_upload"("p_venue_key" "text", "p_upload_kind" "text", "p_bytes" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $_$
declare
  v_daily_bytes bigint;
  v_total_bytes bigint;
  v_pending_bytes bigint;
  v_daily_limit bigint;
  v_total_limit bigint;
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_venue_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_upload_kind not in ('review', 'support')
    or coalesce(p_bytes, 0) < 1 then
    raise exception 'Invalid venue upload reservation.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_venue_key || ':' || p_upload_kind, 0));
  delete from private.venue_upload_reservations where created_at < now() - interval '15 minutes';

  select coalesce(sum(reserved_bytes), 0) into v_pending_bytes
  from private.venue_upload_reservations
  where venue_key = p_venue_key and upload_kind = p_upload_kind;

  if p_upload_kind = 'review' then
    select coalesce(sum(file_size_bytes), 0),
           coalesce(sum(file_size_bytes) filter (where created_at >= now() - interval '24 hours'), 0)
    into v_total_bytes, v_daily_bytes
    from public.venue_result_reviews where venue_key = p_venue_key;
    v_daily_limit := 200000000;
    v_total_limit := 2000000000;
  else
    select coalesce(sum(file_size_bytes), 0),
           coalesce(sum(file_size_bytes) filter (where uploaded_at >= now() - interval '24 hours'), 0)
    into v_total_bytes, v_daily_bytes
    from public.venue_support_bundles where venue_key = p_venue_key;
    v_daily_limit := 50000000;
    v_total_limit := 500000000;
  end if;

  if v_daily_bytes + v_pending_bytes + p_bytes > v_daily_limit
    or v_total_bytes + v_pending_bytes + p_bytes > v_total_limit then
    raise exception 'Venue upload quota reached.';
  end if;

  insert into private.venue_upload_reservations (venue_key, upload_kind, reserved_bytes)
  values (p_venue_key, p_upload_kind, p_bytes)
  returning id into v_id;
  return v_id;
end;
$_$;


ALTER FUNCTION "public"."service_reserve_venue_upload"("p_venue_key" "text", "p_upload_kind" "text", "p_bytes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_detail"("p_session_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_payload jsonb;
begin
  with selected_session as (
    select s.*
    from public.sessions s
    where s.id = p_session_id
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and (
        s.visibility = 'public'
        or (s.visibility = 'private' and s.booking_type <> 'ticket')
        or s.booking_type = 'ticket'
        or s.owner_id = v_actor
        or v_actor_rank >= 50
        or exists (
          select 1
          from public.session_participants sp
          where sp.session_id = s.id
            and sp.profile_id = v_actor
            and sp.deleted_at is null
        )
        or exists (
          select 1
          from public.session_invites si
          where si.session_id = s.id
            and si.recipient_id = v_actor
        )
      )
    limit 1
  ),
  participant_rows as (
    select
      sp.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'profile_id', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.profile_id else null end,
          'display_name', sp.display_name,
          'avatar_url', sp.avatar_url,
          'avatar_emoji', sp.avatar_emoji,
          'avatar_initials', sp.avatar_initials,
          'avatar_color', sp.avatar_color,
          'avatar_text_color', sp.avatar_text_color,
          'profile_motto', sp.profile_motto,
          'checked_in', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.checked_in else null end,
          'payment_status', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.payment_status else null end,
          'payment_amount', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.payment_amount else null end,
          'payment_splits', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.payment_splits else null end,
          'score', sp.score,
          'accuracy_percent', sp.accuracy_percent,
          'projectiles_fired', sp.projectiles_fired,
          'escape_duration_seconds', sp.escape_duration_seconds,
          'placement', sp.placement,
          'prize_claimed', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.prize_claimed else null end,
          'prize_claimed_at', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.prize_claimed_at else null end
        )
        order by sp.id
      ) as session_participants
    from public.session_participants sp
    join selected_session s on s.id = sp.session_id
    where sp.deleted_at is null
      and (
        s.booking_type is distinct from 'ticket'
        or v_actor_rank >= 50
        or sp.profile_id = v_actor
        or s.owner_id = v_actor
      )
    group by sp.session_id
  ),
  waitlist_rows as (
    select
      sw.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.id else null end,
          'session_id', sw.session_id,
          'profile_id', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.profile_id else null end,
          'display_name', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.display_name else null end,
          'avatar_url', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_url else null end,
          'avatar_emoji', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_emoji else null end,
          'avatar_initials', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_initials else null end,
          'avatar_color', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_color else null end,
          'avatar_text_color', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_text_color else null end,
          'profile_motto', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.profile_motto else null end,
          'created_at', sw.created_at
        )
        order by sw.created_at asc, sw.id
      ) as session_waitlist
    from public.session_waitlist sw
    join selected_session s on s.id = sw.session_id
    where v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor
    group by sw.session_id
  ),
  invite_rows as (
    select
      si.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'session_id', si.session_id,
          'inviter_id', si.inviter_id,
          'recipient_id', si.recipient_id,
          'recipient_display_name', si.recipient_display_name,
          'recipient_avatar_url', si.recipient_avatar_url,
          'recipient_avatar_emoji', si.recipient_avatar_emoji,
          'recipient_avatar_initials', si.recipient_avatar_initials,
          'recipient_avatar_color', si.recipient_avatar_color,
          'recipient_avatar_text_color', si.recipient_avatar_text_color,
          'recipient_profile_motto', si.recipient_profile_motto,
          'status', si.status,
          'created_at', si.created_at
        )
        order by si.created_at desc, si.id
      ) as session_invites
    from public.session_invites si
    join selected_session s on s.id = si.session_id
    where v_actor is not null
      and (v_actor_rank >= 50 or s.owner_id = v_actor or si.inviter_id = v_actor or si.recipient_id = v_actor)
    group by si.session_id
  ),
  participant_profile_ids as (
    select distinct sp.profile_id
    from public.session_participants sp
    join selected_session s on s.id = sp.session_id
    where sp.deleted_at is null
      and (v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor)
  )
  select jsonb_build_object(
    'session',
    jsonb_build_object(
      'id', s.id,
        'venue_key', s.venue_key,
      'owner_id', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.owner_id else null end,
      'club_id', s.club_id,
      'session_type', s.session_type,
      'name', s.name,
      'date', s.date,
      'start_time', s.start_time,
      'duration_minutes', s.duration_minutes,
      'max_players', s.max_players,
      'arena_count', s.arena_count,
      'game_options', s.game_options,
      'game_votes', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.game_votes else '{}'::jsonb end,
      'confirmed_game_id', s.confirmed_game_id,
      'visibility', s.visibility,
      'invite_code', case
        when v_actor_rank >= 50
          or s.owner_id = v_actor
          or exists (
            select 1
            from public.session_participants joined_participant
            where joined_participant.session_id = s.id
              and joined_participant.profile_id = v_actor
              and joined_participant.deleted_at is null
          )
        then s.invite_code
        else null
      end,
      'notes', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.notes else null end,
      'status', s.status,
      'tournament_format', s.tournament_format,
      'best_of', s.best_of,
      'rounds_per_match', s.rounds_per_match,
      'require_payment', s.require_payment,
      'qualification_rule', s.qualification_rule,
      'custom_qualifiers', s.custom_qualifiers,
      'enable_third_place_match', s.enable_third_place_match,
      'first_prize', s.first_prize,
      'second_prize', s.second_prize,
      'third_prize', s.third_prize,
      'tournament_locked', s.tournament_locked,
      'seeded', s.seeded,
      'seed_label', s.seed_label,
      'seed_batch', case when v_actor_rank >= 50 then s.seed_batch else null end,
      'booking_type', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end,
      'ticket_type', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end,
      'ticket_player_count', s.ticket_player_count,
      'ticket_total_price', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_total_price else null end,
      'ticket_unit_price', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_unit_price else null end,
      'ticket_status', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_status else null end,
      'ticket_reference', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_reference else null end,
      'ticket_customer_id', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_customer_id else null end,
      'challenge_target_id', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_target_id else null end,
      'challenge_status', s.challenge_status,
      'challenge_accepted_at', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_accepted_at else null end,
      'challenge_declined_at', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_declined_at else null end,
      'session_participants', coalesce(pr.session_participants, '[]'::jsonb),
      'session_waitlist', coalesce(wr.session_waitlist, '[]'::jsonb)
    ),
    'invites',
    coalesce(ir.session_invites, '[]'::jsonb),
    'scoreAdjustments',
    coalesce((
      select jsonb_object_agg(p.id::text, coalesce(p.score_adjustment, 0))
      from public.profiles p
      join participant_profile_ids ids on ids.profile_id = p.id
      where p.deleted_at is null
    ), '{}'::jsonb)
  )
  into v_payload
  from selected_session s
  left join participant_rows pr on pr.session_id = s.id
  left join waitlist_rows wr on wr.session_id = s.id
  left join invite_rows ir on ir.session_id = s.id;

  return coalesce(v_payload, jsonb_build_object(
    'session', null,
    'invites', '[]'::jsonb,
    'scoreAdjustments', '{}'::jsonb
  ));
end;
$$;


ALTER FUNCTION "public"."session_detail"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sessions_list_page"("p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 120, "p_offset" integer DEFAULT 0, "p_include_blocked_times" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sessions jsonb := '[]'::jsonb;
  v_score_adjustments jsonb := '{}'::jsonb;
  v_blocked_times jsonb := '[]'::jsonb;
  v_has_more_after boolean := false;
begin
  with selected_sessions as (
    select s.*
    from public.sessions s
    where s.deleted_at is null
      and s.status <> 'cancelled'
      and (p_start_date is null or s.date >= p_start_date)
      and (p_end_date is null or s.date <= p_end_date)
      and (
        s.visibility = 'public'
        or (s.visibility = 'private' and s.booking_type <> 'ticket')
        or s.booking_type = 'ticket'
        or s.owner_id = v_actor
        or v_actor_rank >= 50
        or exists (
          select 1
          from public.session_participants sp
          where sp.session_id = s.id
            and sp.profile_id = v_actor
            and sp.deleted_at is null
        )
        or exists (
          select 1
          from public.session_invites si
          where si.session_id = s.id
            and si.recipient_id = v_actor
        )
      )
    order by s.date asc, s.start_time asc, s.id asc
    limit v_limit
    offset v_offset
  ),
  participant_rows as (
    select
      sp.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'profile_id', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.profile_id else null end,
          'display_name', sp.display_name,
          'avatar_url', sp.avatar_url,
          'avatar_emoji', sp.avatar_emoji,
          'avatar_initials', sp.avatar_initials,
          'avatar_color', sp.avatar_color,
          'avatar_text_color', sp.avatar_text_color,
          'profile_motto', sp.profile_motto,
          'checked_in', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.checked_in else null end
        )
        order by sp.id
      ) as session_participants
    from public.session_participants sp
    join selected_sessions s on s.id = sp.session_id
    where sp.deleted_at is null
      and (
        s.booking_type is distinct from 'ticket'
        or v_actor_rank >= 50
        or sp.profile_id = v_actor
        or s.owner_id = v_actor
      )
    group by sp.session_id
  ),
  waitlist_rows as (
    select
      sw.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.id else null end,
          'session_id', sw.session_id,
          'profile_id', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.profile_id else null end,
          'created_at', sw.created_at
        )
        order by sw.created_at asc, sw.id
      ) as session_waitlist
    from public.session_waitlist sw
    join selected_sessions s on s.id = sw.session_id
    where v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor
    group by sw.session_id
  ),
  participant_profile_ids as (
    select distinct sp.profile_id
    from public.session_participants sp
    join selected_sessions s on s.id = sp.session_id
    where sp.deleted_at is null
      and (v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor)
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'venue_key', s.venue_key,
        'owner_id', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.owner_id else null end,
        'club_id', s.club_id,
        'session_type', s.session_type,
        'name', s.name,
        'date', s.date,
        'start_time', s.start_time,
        'duration_minutes', s.duration_minutes,
        'max_players', s.max_players,
        'arena_count', s.arena_count,
        'game_options', s.game_options,
        'game_votes', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.game_votes else '{}'::jsonb end,
        'confirmed_game_id', s.confirmed_game_id,
        'visibility', s.visibility,
        'invite_code', case
          when v_actor_rank >= 50
            or s.owner_id = v_actor
            or exists (
              select 1
              from public.session_participants joined_participant
              where joined_participant.session_id = s.id
                and joined_participant.profile_id = v_actor
                and joined_participant.deleted_at is null
            )
          then s.invite_code
          else null
        end,
        'status', s.status,
        'rounds_per_match', s.rounds_per_match,
        'seeded', s.seeded,
        'seed_label', s.seed_label,
        'booking_type', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end,
        'ticket_type', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end,
        'ticket_player_count', s.ticket_player_count,
        'challenge_target_id', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_target_id else null end,
        'challenge_status', s.challenge_status,
        'session_participants', coalesce(pr.session_participants, '[]'::jsonb),
        'session_waitlist', coalesce(wr.session_waitlist, '[]'::jsonb)
      )
      order by s.date asc, s.start_time asc, s.id asc
    ), '[]'::jsonb),
    coalesce((
      select jsonb_object_agg(p.id::text, coalesce(p.score_adjustment, 0))
      from public.profiles p
      join participant_profile_ids ids on ids.profile_id = p.id
      where p.deleted_at is null
    ), '{}'::jsonb)
  into v_sessions, v_score_adjustments
  from selected_sessions s
  left join participant_rows pr on pr.session_id = s.id
  left join waitlist_rows wr on wr.session_id = s.id;

  if p_end_date is not null then
    select exists (
      select 1
      from public.sessions s
      where s.deleted_at is null
        and s.status <> 'cancelled'
        and s.date > p_end_date
    )
    into v_has_more_after;
  end if;

  if p_include_blocked_times and v_actor_rank >= 50 then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', bt.date,
        'start_time', bt.start_time,
        'end_time', bt.end_time,
        'arenas_used', bt.arenas_used
      )
      order by bt.date asc, bt.start_time asc
    ), '[]'::jsonb)
    into v_blocked_times
    from public.blocked_times bt
    where (p_start_date is null or bt.date >= p_start_date)
      and (p_end_date is null or bt.date <= p_end_date);
  end if;

  return jsonb_build_object(
    'sessions', coalesce(v_sessions, '[]'::jsonb),
    'scoreAdjustments', coalesce(v_score_adjustments, '{}'::jsonb),
    'blockedTimes', coalesce(v_blocked_times, '[]'::jsonb),
    'hasMoreAfter', coalesce(v_has_more_after, false),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;


ALTER FUNCTION "public"."sessions_list_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_include_blocked_times" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_loyalty_points"("p_profile_id" "uuid", "p_points" integer, "p_reason" "text" DEFAULT NULL::"text") RETURNS TABLE("profile_id" "uuid", "loyalty_points_total" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current integer;
  v_delta integer;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_points is null or p_points < 0 then
    raise exception 'Loyalty points must be zero or higher.';
  end if;

  select profiles.loyalty_points_total
  into v_current
  from public.profiles
  where profiles.id = p_profile_id
    and profiles.deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  v_delta := p_points - coalesce(v_current, 0);

  return query
  select result.profile_id, result.loyalty_points_total
  from public.apply_loyalty_points_delta(
    p_profile_id,
    v_delta,
    null,
    'manual_adjustment',
    null,
    coalesce(nullif(btrim(p_reason), ''), 'Staff Console manual balance edit'),
    v_actor
  ) as result;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    'loyalty_points_total_edited',
    'profiles',
    p_profile_id,
    jsonb_build_object('loyalty_points_total', v_current),
    jsonb_build_object('loyalty_points_total', p_points)
  );
end;
$$;


ALTER FUNCTION "public"."set_profile_loyalty_points"("p_profile_id" "uuid", "p_points" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_score_adjustment"("p_profile_id" "uuid", "p_score_adjustment" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_score integer;
  v_saved_score integer;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
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


ALTER FUNCTION "public"."set_profile_score_adjustment"("p_profile_id" "uuid", "p_score_adjustment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision DEFAULT NULL::double precision, "p_best_escape_duration_seconds" integer DEFAULT NULL::integer, "p_update_average_accuracy" boolean DEFAULT false, "p_update_best_escape_duration" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_average_accuracy double precision;
  v_old_best_escape_duration_seconds integer;
  v_saved_average_accuracy double precision;
  v_saved_best_escape_duration_seconds integer;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_update_average_accuracy and p_average_accuracy is not null and (p_average_accuracy < 0 or p_average_accuracy > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_update_best_escape_duration and p_best_escape_duration_seconds is not null and p_best_escape_duration_seconds <= 0 then
    raise exception 'Best escape time must be greater than 0.';
  end if;

  select average_accuracy_override, best_escape_duration_seconds_override
  into v_old_average_accuracy, v_old_best_escape_duration_seconds
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set average_accuracy_override = case when p_update_average_accuracy then p_average_accuracy else average_accuracy_override end,
      best_escape_duration_seconds_override = case when p_update_best_escape_duration then p_best_escape_duration_seconds else best_escape_duration_seconds_override end,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning average_accuracy_override, best_escape_duration_seconds_override
  into v_saved_average_accuracy, v_saved_best_escape_duration_seconds;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'profile_stat_overrides_updated',
      'profile',
      p_profile_id,
      jsonb_build_object(
        'average_accuracy_override', v_old_average_accuracy,
        'best_escape_duration_seconds_override', v_old_best_escape_duration_seconds
      ),
      jsonb_build_object(
        'average_accuracy_override', v_saved_average_accuracy,
        'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds
      )
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'average_accuracy_override', v_saved_average_accuracy,
    'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds
  );
end;
$$;


ALTER FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision, "p_best_escape_duration_seconds" integer, "p_update_average_accuracy" boolean, "p_update_best_escape_duration" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision DEFAULT NULL::double precision, "p_best_escape_duration_seconds" integer DEFAULT NULL::integer, "p_update_average_accuracy" boolean DEFAULT false, "p_update_best_escape_duration" boolean DEFAULT false, "p_total_projectiles" integer DEFAULT NULL::integer, "p_update_total_projectiles" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_average_accuracy double precision;
  v_old_best_escape_duration_seconds integer;
  v_old_total_projectiles integer;
  v_saved_average_accuracy double precision;
  v_saved_best_escape_duration_seconds integer;
  v_saved_total_projectiles integer;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_update_average_accuracy and p_average_accuracy is not null and (p_average_accuracy < 0 or p_average_accuracy > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_update_best_escape_duration and p_best_escape_duration_seconds is not null and p_best_escape_duration_seconds <= 0 then
    raise exception 'Best escape time must be greater than 0.';
  end if;

  if p_update_total_projectiles and p_total_projectiles is not null and p_total_projectiles < 0 then
    raise exception 'Shots must be zero or higher.';
  end if;

  select average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override
  into v_old_average_accuracy, v_old_best_escape_duration_seconds, v_old_total_projectiles
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set average_accuracy_override = case when p_update_average_accuracy then p_average_accuracy else average_accuracy_override end,
      best_escape_duration_seconds_override = case when p_update_best_escape_duration then p_best_escape_duration_seconds else best_escape_duration_seconds_override end,
      total_projectiles_override = case when p_update_total_projectiles then p_total_projectiles else total_projectiles_override end,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override
  into v_saved_average_accuracy, v_saved_best_escape_duration_seconds, v_saved_total_projectiles;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'profile_stat_overrides_updated',
      'profile',
      p_profile_id,
      jsonb_build_object(
        'average_accuracy_override', v_old_average_accuracy,
        'best_escape_duration_seconds_override', v_old_best_escape_duration_seconds,
        'total_projectiles_override', v_old_total_projectiles
      ),
      jsonb_build_object(
        'average_accuracy_override', v_saved_average_accuracy,
        'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds,
        'total_projectiles_override', v_saved_total_projectiles
      )
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'average_accuracy_override', v_saved_average_accuracy,
    'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds,
    'total_projectiles_override', v_saved_total_projectiles
  );
end;
$$;


ALTER FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision, "p_best_escape_duration_seconds" integer, "p_update_average_accuracy" boolean, "p_update_best_escape_duration" boolean, "p_total_projectiles" integer, "p_update_total_projectiles" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_session_participant_chapter_time"("p_participant_id" "uuid", "p_game_slug" "text", "p_chapter_number" integer, "p_duration_seconds" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_participant public.session_participants%rowtype;
  v_session public.sessions%rowtype;
  v_game public.staff_games%rowtype;
  v_saved public.session_participant_chapter_times%rowtype;
  v_normalized_game_slug text := lower(nullif(btrim(p_game_slug), ''));
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_participant_id is null then
    raise exception 'Participant id is required.';
  end if;

  if v_normalized_game_slug is null then
    raise exception 'Game is required.';
  end if;

  if p_chapter_number is null or p_chapter_number < 1 then
    raise exception 'Chapter number is required.';
  end if;

  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'Chapter time must be greater than 0.';
  end if;

  select *
  into v_participant
  from public.session_participants
  where id = p_participant_id
    and deleted_at is null;

  if not found then
    raise exception 'Participant not found.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = v_participant.session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  select *
  into v_game
  from public.staff_games
  where slug = v_normalized_game_slug
  limit 1;

  if found then
    if v_game.game_type <> 'escape' then
      raise exception 'Chapter times can only be saved for Escape games.';
    end if;

    if p_chapter_number > coalesce(v_game.escape_chapter_count, 1) then
      raise exception 'Chapter number is higher than this game allows.';
    end if;
  end if;

  insert into public.session_participant_chapter_times (
    session_id,
    participant_id,
    profile_id,
    staff_game_id,
    game_slug,
    chapter_number,
    duration_seconds,
    recorded_by
  )
  values (
    v_session.id,
    v_participant.id,
    v_participant.profile_id,
    case when v_game.id is null then null else v_game.id end,
    v_normalized_game_slug,
    p_chapter_number,
    p_duration_seconds,
    v_actor
  )
  on conflict (participant_id, game_slug, chapter_number)
  do update set
    duration_seconds = excluded.duration_seconds,
    recorded_by = excluded.recorded_by,
    updated_at = now()
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'session_id', v_saved.session_id,
    'participant_id', v_saved.participant_id,
    'profile_id', v_saved.profile_id,
    'game_slug', v_saved.game_slug,
    'chapter_number', v_saved.chapter_number,
    'duration_seconds', v_saved.duration_seconds
  );
end;
$$;


ALTER FUNCTION "public"."set_session_participant_chapter_time"("p_participant_id" "uuid", "p_game_slug" "text", "p_chapter_number" integer, "p_duration_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_staff_profile_role"("p_profile_id" "uuid", "p_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_saved_role text;
  v_target_email text;
  v_is_hr_record_only boolean;
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

  select role, lower(email), coalesce(is_hr_record_only, false)
  into v_old_role, v_target_email, v_is_hr_record_only
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if v_is_hr_record_only then
    raise exception 'Employee HR identities do not have an assignable web-app role.';
  end if;

  if v_target_email = 'contact@vre-vietnam.com' then
    raise exception 'The shared store account must keep Employee PIN access.';
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


ALTER FUNCTION "public"."set_staff_profile_role"("p_profile_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_record"("p_entity_table" "text", "p_entity_id" "uuid", "p_delete_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_actor uuid := (select auth.uid());
  v_table text := lower(nullif(btrim(coalesce(p_entity_table, '')), ''));
  v_allowed boolean := false;
  v_is_admin boolean := public.is_vrena_admin();
  v_count integer := 0;
  v_session_id uuid;
  v_profile_id uuid;
  v_owner_id uuid;
  v_club_id uuid;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if p_entity_id is null then
    raise exception 'Record id is required.';
  end if;

  if v_table not in ('profiles', 'sessions', 'session_participants', 'session_messages', 'club_members', 'tournament_pools', 'tournament_pool_entries', 'tournament_matches') then
    raise exception 'Unsupported soft-delete table.';
  end if;

  if v_table = 'profiles' then
    v_allowed := p_entity_id = v_actor or public.is_vrena_super_admin();
  elsif v_table = 'sessions' then
    select owner_id into v_owner_id
    from public.sessions
    where id = p_entity_id;
    v_allowed := v_is_admin or v_owner_id = v_actor;
  elsif v_table = 'session_participants' then
    select session_participants.session_id, session_participants.profile_id, sessions.owner_id
    into v_session_id, v_profile_id, v_owner_id
    from public.session_participants
    join public.sessions on sessions.id = session_participants.session_id
    where session_participants.id = p_entity_id;
    v_allowed := v_is_admin
      or v_profile_id = v_actor
      or v_owner_id = v_actor
      or exists (
        select 1
        from public.tournament_editors
        where tournament_editors.session_id = v_session_id
          and tournament_editors.profile_id = v_actor
      );
  elsif v_table = 'session_messages' then
    v_allowed := v_is_admin;
  elsif v_table = 'club_members' then
    select club_members.club_id, club_members.profile_id, clubs.owner_id
    into v_club_id, v_profile_id, v_owner_id
    from public.club_members
    join public.clubs on clubs.id = club_members.club_id
    where club_members.id = p_entity_id;
    v_allowed := v_is_admin
      or v_profile_id = v_actor
      or v_owner_id = v_actor
      or exists (
        select 1
        from public.club_members actor_membership
        where actor_membership.club_id = v_club_id
          and actor_membership.profile_id = v_actor
          and actor_membership.status = 'approved'
          and actor_membership.deleted_at is null
          and actor_membership.role in ('owner', 'admin', 'moderator')
      );
  else
    execute format('select session_id from public.%I where id = $1', v_table)
    into v_session_id
    using p_entity_id;
    select owner_id into v_owner_id
    from public.sessions
    where id = v_session_id;
    v_allowed := v_is_admin
      or v_owner_id = v_actor
      or exists (
        select 1
        from public.tournament_editors
        where tournament_editors.session_id = v_session_id
          and tournament_editors.profile_id = v_actor
      );
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Not allowed to delete this record.';
  end if;

  if v_is_admin then
    perform public.consume_rate_limit('admin_destructive', 3, 60, v_table || ':' || p_entity_id::text);
  end if;

  execute format(
    'update public.%I set deleted_at = now(), deleted_by = $1, delete_reason = $2 where id = $3 and deleted_at is null',
    v_table
  )
  using v_actor, nullif(btrim(coalesce(p_delete_reason, '')), ''), p_entity_id;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No active record found to delete.';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
  values (
    v_actor,
    'soft_deleted',
    v_table,
    p_entity_id,
    jsonb_build_object('reason', p_delete_reason)
  );

  return jsonb_build_object('deleted', true, 'entity_table', v_table, 'entity_id', p_entity_id);
end;
$_$;


ALTER FUNCTION "public"."soft_delete_record"("p_entity_table" "text", "p_entity_id" "uuid", "p_delete_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_tournament_records"("p_session_id" "uuid", "p_include_pools" boolean DEFAULT false, "p_delete_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean := public.is_vrena_admin();
  v_owner_id uuid;
  v_reason text := nullif(btrim(coalesce(p_delete_reason, '')), '');
  v_matches integer := 0;
  v_entries integer := 0;
  v_pools integer := 0;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  select owner_id into v_owner_id
  from public.sessions
  where id = p_session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  if not (
    v_is_admin
    or v_owner_id = v_actor
    or exists (
      select 1
      from public.tournament_editors
      where tournament_editors.session_id = p_session_id
        and tournament_editors.profile_id = v_actor
    )
  ) then
    raise exception 'Not allowed to update tournament records.';
  end if;

  if v_is_admin then
    perform public.consume_rate_limit('admin_destructive', 3, 60, 'tournament:' || p_session_id::text);
  end if;

  update public.tournament_matches
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = v_reason
  where session_id = p_session_id
    and deleted_at is null;
  get diagnostics v_matches = row_count;

  if coalesce(p_include_pools, false) then
    update public.tournament_pool_entries
    set deleted_at = now(),
        deleted_by = v_actor,
        delete_reason = v_reason
    where session_id = p_session_id
      and deleted_at is null;
    get diagnostics v_entries = row_count;

    update public.tournament_pools
    set deleted_at = now(),
        deleted_by = v_actor,
        delete_reason = v_reason
    where session_id = p_session_id
      and deleted_at is null;
    get diagnostics v_pools = row_count;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
  values (
    v_actor,
    'tournament_records_soft_deleted',
    'session',
    p_session_id,
    jsonb_build_object('matches', v_matches, 'entries', v_entries, 'pools', v_pools, 'reason', v_reason)
  );

  return jsonb_build_object('matches', v_matches, 'entries', v_entries, 'pools', v_pools);
end;
$$;


ALTER FUNCTION "public"."soft_delete_tournament_records"("p_session_id" "uuid", "p_include_pools" boolean, "p_delete_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_approve_attendance_period"("p_period_start" "date", "p_period_end" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer := 0;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 100 then
    raise exception 'Only an owner or administrator can approve attendance.';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Choose a valid attendance approval period.';
  end if;

  update public.staff_attendance_logs
  set
    approval_status = 'approved',
    approved_by = v_actor,
    approved_at = now()
  where work_date between p_period_start and p_period_end
    and deleted_at is null;
  get diagnostics v_count = row_count;

  insert into public.staff_attendance_approvals (
    period_start,
    period_end,
    approved_log_count,
    approved_by,
    approved_at
  ) values (
    p_period_start,
    p_period_end,
    v_count,
    v_actor,
    now()
  )
  on conflict (period_start, period_end) do update
  set
    approved_log_count = excluded.approved_log_count,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at;

  return jsonb_build_object(
    'period_start', p_period_start,
    'period_end', p_period_end,
    'approved_log_count', v_count
  );
end;
$$;


ALTER FUNCTION "public"."staff_approve_attendance_period"("p_period_start" "date", "p_period_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_attendance_apply_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_settings public.staff_attendance_settings%rowtype;
  v_shift_start timestamp;
  v_shift_end timestamp;
  v_scheduled_minutes integer := 0;
  v_clock_in timestamp;
  v_clock_out timestamp;
  v_worked_minutes integer := 0;
  v_raw_late_minutes integer := 0;
  v_raw_early_minutes integer := 0;
  v_before_shift_minutes integer := 0;
  v_after_shift_minutes integer := 0;
begin
  select * into v_settings
  from public.staff_attendance_settings
  where id = 'default';

  if not found then
    return new;
  end if;

  if coalesce(v_settings.single_clock_for_consecutive_shifts, true) then
    select
      min(shift.shift_date + shift.start_time),
      max(
        shift.shift_date + shift.end_time
        + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
      ),
      coalesce(sum(greatest(
        0,
        floor(extract(epoch from (
          shift.shift_date + shift.end_time
          + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
          - (shift.shift_date + shift.start_time)
        )) / 60)::integer - coalesce(shift.break_minutes, 0)
      )), 0)::integer
    into v_shift_start, v_shift_end, v_scheduled_minutes
    from public.staff_schedule_shifts as shift
    where shift.staff_profile_id = new.staff_profile_id
      and shift.shift_date = new.work_date
      and shift.status in ('published', 'completed')
      and shift.deleted_at is null;
  elsif new.shift_id is not null then
    select
      shift.shift_date + shift.start_time,
      shift.shift_date + shift.end_time
        + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end,
      greatest(
        0,
        floor(extract(epoch from (
          shift.shift_date + shift.end_time
          + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
          - (shift.shift_date + shift.start_time)
        )) / 60)::integer - coalesce(shift.break_minutes, 0)
      )
    into v_shift_start, v_shift_end, v_scheduled_minutes
    from public.staff_schedule_shifts as shift
    where shift.id = new.shift_id;
  end if;

  v_clock_in := new.clock_in_at at time zone 'Asia/Ho_Chi_Minh';
  v_clock_out := new.clock_out_at at time zone 'Asia/Ho_Chi_Minh';

  if v_clock_in is not null and v_shift_start is not null then
    v_raw_late_minutes := greatest(
      0,
      floor(extract(epoch from (v_clock_in - v_shift_start)) / 60)::integer
    );
    new.late_minutes := case
      when v_settings.late_arrival_enabled
        and v_raw_late_minutes > v_settings.late_after_minutes then v_raw_late_minutes
      else 0
    end;

    if new.status not in ('absent', 'no_show', 'leave', 'holiday') then
      new.status := case when new.late_minutes > 0 then 'late' else 'present' end;
    end if;
  else
    new.late_minutes := 0;
  end if;

  if v_clock_out is not null and v_shift_end is not null then
    v_raw_early_minutes := greatest(
      0,
      floor(extract(epoch from (v_shift_end - v_clock_out)) / 60)::integer
    );
    new.early_leave_minutes := case
      when v_settings.early_leave_enabled
        and v_raw_early_minutes > v_settings.early_leave_before_minutes then v_raw_early_minutes
      else 0
    end;
  else
    new.early_leave_minutes := 0;
  end if;

  if v_clock_in is not null and v_clock_out is not null then
    v_worked_minutes := greatest(
      0,
      floor(extract(epoch from (new.clock_out_at - new.clock_in_at)) / 60)::integer
        - coalesce(new.break_minutes, 0)
    );

    if v_shift_start is not null then
      v_before_shift_minutes := greatest(
        0,
        floor(extract(epoch from (v_shift_start - v_clock_in)) / 60)::integer
      );
    end if;
    if v_shift_end is not null then
      v_after_shift_minutes := greatest(
        0,
        floor(extract(epoch from (v_clock_out - v_shift_end)) / 60)::integer
      );
    end if;

    new.regular_minutes := case
      when v_scheduled_minutes > 0 then least(v_worked_minutes, v_scheduled_minutes)
      else least(v_worked_minutes, v_settings.standard_daily_minutes)
    end;
    new.overtime_minutes :=
      case
        when v_settings.overtime_before_shift_enabled
          and v_before_shift_minutes >= v_settings.overtime_before_shift_minutes
        then v_before_shift_minutes
        else 0
      end
      + case
        when v_settings.overtime_after_shift_enabled
          and v_after_shift_minutes >= v_settings.overtime_after_shift_minutes
        then v_after_shift_minutes
        else 0
      end;
    new.is_half_day := v_settings.half_day_enabled
      and v_worked_minutes > v_settings.half_day_min_minutes
      and v_worked_minutes <= v_settings.half_day_max_minutes;

    if new.is_half_day and not v_settings.count_late_early_on_half_day then
      new.late_minutes := 0;
      new.early_leave_minutes := 0;
      if new.status = 'late' then new.status := 'present'; end if;
    end if;
  else
    new.is_half_day := false;
  end if;

  if tg_op = 'UPDATE' and (
    new.clock_in_at is distinct from old.clock_in_at
    or new.clock_out_at is distinct from old.clock_out_at
    or new.break_minutes is distinct from old.break_minutes
    or new.shift_id is distinct from old.shift_id
    or new.status is distinct from old.status
  ) then
    new.approval_status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."staff_attendance_apply_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_attendance_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_attendance_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_action text;
  v_actor uuid := (select auth.uid());
begin
  if TG_TABLE_NAME = 'staff_games' then
    if TG_OP = 'INSERT' then
      v_action := 'game_created';
    elsif old.active = true and new.active = false then
      v_action := 'game_deactivated';
    else
      v_action := 'game_edited';
    end if;
  elsif TG_TABLE_NAME = 'staff_pricing_rules' then
    if TG_OP = 'INSERT' then
      v_action := 'price_created';
    elsif old.active = true and new.active = false then
      v_action := 'price_deactivated';
    else
      v_action := 'price_edited';
    end if;
  elsif TG_TABLE_NAME = 'staff_discount_rules' then
    if TG_OP = 'INSERT' then
      v_action := 'discount_created';
    elsif old.active = true and new.active = false then
      v_action := 'discount_deactivated';
    else
      v_action := 'discount_edited';
    end if;
  elsif TG_TABLE_NAME = 'staff_orders' then
    if TG_OP = 'INSERT' then
      v_action := 'order_created';
    elsif old.payment_status is distinct from new.payment_status then
      v_action := 'payment_status_changed';
    elsif old.order_status is distinct from new.order_status and new.order_status = 'cancelled' then
      v_action := 'order_cancelled';
    elsif old.order_status is distinct from new.order_status and new.order_status = 'refunded' then
      v_action := 'order_refunded';
    elsif old.discount_total is distinct from new.discount_total or old.discount_rule_id is distinct from new.discount_rule_id then
      v_action := 'discount_applied';
    else
      v_action := 'order_edited';
    end if;
  else
    v_action := lower(TG_OP);
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    v_action,
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then old.id else new.id end,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."staff_audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_award_profile_achievement"("p_profile_id" "uuid", "p_achievement_id" "text", "p_achievement_kind" "text", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_achievement_id text := nullif(trim(coalesce(p_achievement_id, '')), '');
  v_achievement_kind text := nullif(trim(coalesce(p_achievement_kind, '')), '');
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_award public.profile_achievement_awards%rowtype;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Choose a player first.';
  end if;

  if v_achievement_id is null or length(v_achievement_id) > 120 then
    raise exception 'Choose a valid achievement.';
  end if;

  if v_achievement_kind not in ('game', 'retention') then
    raise exception 'Choose a valid achievement type.';
  end if;

  if v_title is null or length(v_title) > 160 then
    raise exception 'Achievement title is required.';
  end if;

  if v_description is not null and length(v_description) > 500 then
    raise exception 'Achievement description is too long.';
  end if;

  if v_note is not null and length(v_note) > 500 then
    raise exception 'Staff note is too long.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  if exists (
    select 1
    from public.profile_achievement_awards
    where profile_id = p_profile_id
      and achievement_kind = v_achievement_kind
      and achievement_id = v_achievement_id
      and revoked_at is null
  ) then
    raise exception 'Already awarded to this player.';
  end if;

  insert into public.profile_achievement_awards (
    profile_id,
    achievement_id,
    achievement_kind,
    title,
    description,
    note,
    awarded_by
  )
  values (
    p_profile_id,
    v_achievement_id,
    v_achievement_kind,
    v_title,
    v_description,
    v_note,
    v_actor
  )
  returning * into v_award;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
    values (
      v_actor,
      'achievement_awarded',
      'profile_achievement_awards',
      v_award.id,
      jsonb_build_object(
        'profile_id', v_award.profile_id,
        'achievement_id', v_award.achievement_id,
        'achievement_kind', v_award.achievement_kind,
        'title', v_award.title
      )
    );
  end if;

  return jsonb_build_object(
    'id', v_award.id,
    'profile_id', v_award.profile_id,
    'achievement_id', v_award.achievement_id,
    'achievement_kind', v_award.achievement_kind,
    'title', v_award.title,
    'awarded_at', v_award.awarded_at
  );
end;
$$;


ALTER FUNCTION "public"."staff_award_profile_achievement"("p_profile_id" "uuid", "p_achievement_id" "text", "p_achievement_kind" "text", "p_title" "text", "p_description" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_delete_profile_account"("p_profile_id" "uuid", "p_delete_reason" "text" DEFAULT NULL::"text", "p_ban" boolean DEFAULT false, "p_ban_reason" "text" DEFAULT NULL::"text", "p_confirmation" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_delete_reason text := nullif(btrim(coalesce(p_delete_reason, '')), '');
  v_ban_reason text := nullif(btrim(coalesce(p_ban_reason, p_delete_reason, '')), '');
  v_target_role text;
  v_target_email text;
  v_target_rank integer;
  v_count integer := 0;
begin
  if v_actor is null or v_actor_rank < 100 then
    raise exception 'Admin access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_profile_id = v_actor then
    raise exception 'You cannot delete your own Staff Console account.';
  end if;

  if coalesce(p_confirmation, '') <> 'DELETE' then
    raise exception 'Type DELETE to confirm account deletion.';
  end if;

  perform public.consume_rate_limit('admin_destructive', 3, 60, 'profile-account:' || p_profile_id::text);

  select profiles.role, profiles.email
  into v_target_role, v_target_email
  from public.profiles
  where profiles.id = p_profile_id
    and profiles.deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  v_target_rank := public.staff_role_rank(v_target_role, v_target_email);

  if v_target_rank >= 120 and v_actor_rank < 120 then
    raise exception 'Owner access required.';
  end if;

  update public.profiles
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = coalesce(v_delete_reason, 'Staff Console account deletion'),
      banned_at = case when coalesce(p_ban, false) then coalesce(profiles.banned_at, now()) else profiles.banned_at end,
      banned_by = case when coalesce(p_ban, false) then v_actor else profiles.banned_by end,
      ban_reason = case when coalesce(p_ban, false) then coalesce(v_ban_reason, v_delete_reason, 'Staff Console ban') else profiles.ban_reason end,
      role = case when coalesce(p_ban, false) and v_target_rank < 120 then 'player' else profiles.role end,
      updated_at = now()
  where profiles.id = p_profile_id
    and profiles.deleted_at is null;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No active profile found to delete.';
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      case when coalesce(p_ban, false) then 'profile_account_deleted_and_banned' else 'profile_account_deleted' end,
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_target_role, 'email', v_target_email),
      jsonb_build_object(
        'deleted', true,
        'banned', coalesce(p_ban, false),
        'delete_reason', coalesce(v_delete_reason, 'Staff Console account deletion'),
        'ban_reason', case when coalesce(p_ban, false) then coalesce(v_ban_reason, v_delete_reason, 'Staff Console ban') else null end
      )
    );
  end if;

  return jsonb_build_object(
    'deleted', true,
    'banned', coalesce(p_ban, false),
    'profile_id', p_profile_id
  );
end;
$$;


ALTER FUNCTION "public"."staff_delete_profile_account"("p_profile_id" "uuid", "p_delete_reason" "text", "p_ban" boolean, "p_ban_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_delete_session_operation"("p_session_id" "uuid", "p_delete_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_session public.sessions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_delete_reason, '')), '');
  v_sessions_deleted integer := 0;
  v_participants_deleted integer := 0;
  v_orders_cancelled integer := 0;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_session_id is null then
    raise exception 'Session id is required.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Session not found.';
  end if;

  update public.session_participants
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = coalesce(v_reason, 'Deleted from Staff Console'),
      updated_at = now()
  where session_id = p_session_id
    and deleted_at is null;
  get diagnostics v_participants_deleted = row_count;

  update public.staff_orders
  set order_status = 'cancelled',
      updated_at = now(),
      internal_note = concat_ws(
        E'\n',
        nullif(internal_note, ''),
        'Session deleted from Staff Console by ' || v_actor::text || ' at ' || now()::text
      )
  where session_id = p_session_id
    and order_status not in ('cancelled', 'refunded');
  get diagnostics v_orders_cancelled = row_count;

  update public.sessions
  set status = 'cancelled',
      deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = coalesce(v_reason, 'Deleted from Staff Console'),
      updated_at = now()
  where id = p_session_id
    and deleted_at is null;
  get diagnostics v_sessions_deleted = row_count;

  if v_sessions_deleted <> 1 then
    raise exception 'Delete scope failed. Expected exactly one session, got %.', v_sessions_deleted;
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'staff_session_deleted',
      'sessions',
      p_session_id,
      to_jsonb(v_session),
      jsonb_build_object(
        'deleted', true,
        'booking_type', v_session.booking_type,
        'ticket_reference', v_session.ticket_reference,
        'ticket_customer_id', v_session.ticket_customer_id,
        'participants_deleted', v_participants_deleted,
        'orders_cancelled', v_orders_cancelled,
        'reason', v_reason
      )
    );
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'ticket_reference', v_session.ticket_reference,
    'ticket_customer_id', v_session.ticket_customer_id,
    'deleted', true,
    'sessions_deleted', v_sessions_deleted,
    'participants_deleted', v_participants_deleted,
    'orders_cancelled', v_orders_cancelled
  );
end;
$$;


ALTER FUNCTION "public"."staff_delete_session_operation"("p_session_id" "uuid", "p_delete_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_discount_rule_amount"("p_discount_type" "text", "p_value" numeric, "p_subtotal" integer, "p_unit_price" integer, "p_max_discount_amount" integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select least(
    greatest(0, coalesce(p_subtotal, 0)),
    greatest(
      0,
      least(
        case
          when p_discount_type in ('percentage', 'birthday', 'resident', 'group')
            then round(greatest(0, coalesce(p_subtotal, 0)) * least(greatest(coalesce(p_value, 0), 0), 100) / 100)::integer
          when p_discount_type = 'fixed_amount'
            then round(greatest(coalesce(p_value, 0), 0))::integer
          when p_discount_type = 'free_ticket'
            then greatest(coalesce(p_unit_price, 0), 0)
          else 0
        end,
        coalesce(p_max_discount_amount, 2147483647)
      )
    )
  );
$$;


ALTER FUNCTION "public"."staff_discount_rule_amount"("p_discount_type" "text", "p_value" numeric, "p_subtotal" integer, "p_unit_price" integer, "p_max_discount_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text" DEFAULT NULL::"text", "p_booking_date" "date" DEFAULT NULL::"date", "p_booking_time" time without time zone DEFAULT NULL::time without time zone, "p_player_count" integer DEFAULT NULL::integer, "p_subtotal" integer DEFAULT NULL::integer, "p_requested_ticket_type" "text" DEFAULT NULL::"text", "p_customer_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_day integer;
  v_scope text := coalesce(nullif(btrim(p_day_scope), ''), 'all');
  v_ticket_type text := coalesce(nullif(btrim(p_ticket_type), ''), 'all');
  v_requested_ticket_type text := coalesce(nullif(btrim(p_requested_ticket_type), ''), 'all');
  v_usage_count integer := 0;
begin
  if not public.staff_discount_rule_matches_game(p_rule_game_id, p_requested_game_id) then
    return false;
  end if;

  if p_min_players is not null and coalesce(p_player_count, 0) < p_min_players then
    return false;
  end if;

  if p_max_players is not null and coalesce(p_player_count, 0) > p_max_players then
    return false;
  end if;

  if coalesce(p_min_order_total, 0) > 0 and coalesce(p_subtotal, 0) < p_min_order_total then
    return false;
  end if;

  if v_ticket_type <> 'all' and v_ticket_type <> v_requested_ticket_type then
    return false;
  end if;

  if v_scope <> 'all' then
    if p_booking_date is null then
      return false;
    end if;

    v_day := extract(isodow from p_booking_date)::integer;
    if v_scope = 'weekday' and v_day not between 1 and 5 then
      return false;
    elsif v_scope = 'weekend' and v_day not in (6, 7) then
      return false;
    elsif v_scope = 'mon' and v_day <> 1 then
      return false;
    elsif v_scope = 'tue' and v_day <> 2 then
      return false;
    elsif v_scope = 'wed' and v_day <> 3 then
      return false;
    elsif v_scope = 'thu' and v_day <> 4 then
      return false;
    elsif v_scope = 'fri' and v_day <> 5 then
      return false;
    elsif v_scope = 'sat' and v_day <> 6 then
      return false;
    elsif v_scope = 'sun' and v_day <> 7 then
      return false;
    end if;
  end if;

  if p_time_start is not null or p_time_end is not null then
    if p_booking_time is null then
      return false;
    end if;

    if p_time_start is not null and p_time_end is not null and p_time_start > p_time_end then
      if not (p_booking_time >= p_time_start or p_booking_time < p_time_end) then
        return false;
      end if;
    elsif (p_time_start is not null and p_booking_time < p_time_start)
      or (p_time_end is not null and p_booking_time >= p_time_end) then
      return false;
    end if;
  end if;

  if p_per_customer_limit is not null and p_customer_id is not null and p_discount_rule_id is not null then
    select
      coalesce((
        select count(*)::integer
        from public.staff_orders
        where customer_id = p_customer_id
          and discount_rule_id = p_discount_rule_id
      ), 0)
      + coalesce((
        select count(*)::integer
        from public.sessions
        where ticket_customer_id = p_customer_id
          and ticket_discount_rule_id = p_discount_rule_id
      ), 0)
    into v_usage_count;

    if v_usage_count >= p_per_customer_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone, "p_player_count" integer, "p_subtotal" integer, "p_requested_ticket_type" "text", "p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_rule_price_rule_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text" DEFAULT NULL::"text", "p_requested_price_rule_id" "uuid" DEFAULT NULL::"uuid", "p_booking_date" "date" DEFAULT NULL::"date", "p_booking_time" time without time zone DEFAULT NULL::time without time zone, "p_player_count" integer DEFAULT NULL::integer, "p_subtotal" integer DEFAULT NULL::integer, "p_requested_ticket_type" "text" DEFAULT NULL::"text", "p_customer_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_day integer;
  v_scope text := coalesce(nullif(btrim(p_day_scope), ''), 'all');
  v_ticket_type text := coalesce(nullif(btrim(p_ticket_type), ''), 'all');
  v_requested_ticket_type text := coalesce(nullif(btrim(p_requested_ticket_type), ''), 'all');
  v_usage_count integer := 0;
begin
  if not public.staff_discount_rule_matches_game(p_rule_game_id, p_requested_game_id) then
    return false;
  end if;

  if p_rule_price_rule_id is not null and p_rule_price_rule_id is distinct from p_requested_price_rule_id then
    return false;
  end if;

  if p_min_players is not null and coalesce(p_player_count, 0) < p_min_players then
    return false;
  end if;

  if p_max_players is not null and coalesce(p_player_count, 0) > p_max_players then
    return false;
  end if;

  if coalesce(p_min_order_total, 0) > 0 and coalesce(p_subtotal, 0) < p_min_order_total then
    return false;
  end if;

  if v_ticket_type <> 'all' and v_ticket_type <> v_requested_ticket_type then
    return false;
  end if;

  if v_scope <> 'all' then
    if p_booking_date is null then
      return false;
    end if;

    v_day := extract(isodow from p_booking_date)::integer;
    if v_scope = 'weekday' and v_day not between 1 and 5 then
      return false;
    elsif v_scope = 'weekend' and v_day not in (6, 7) then
      return false;
    elsif v_scope = 'mon' and v_day <> 1 then
      return false;
    elsif v_scope = 'tue' and v_day <> 2 then
      return false;
    elsif v_scope = 'wed' and v_day <> 3 then
      return false;
    elsif v_scope = 'thu' and v_day <> 4 then
      return false;
    elsif v_scope = 'fri' and v_day <> 5 then
      return false;
    elsif v_scope = 'sat' and v_day <> 6 then
      return false;
    elsif v_scope = 'sun' and v_day <> 7 then
      return false;
    end if;
  end if;

  if p_time_start is not null or p_time_end is not null then
    if p_booking_time is null then
      return false;
    end if;

    if p_time_start is not null and p_time_end is not null and p_time_start > p_time_end then
      if not (p_booking_time >= p_time_start or p_booking_time < p_time_end) then
        return false;
      end if;
    elsif (p_time_start is not null and p_booking_time < p_time_start)
      or (p_time_end is not null and p_booking_time >= p_time_end) then
      return false;
    end if;
  end if;

  if p_per_customer_limit is not null and p_customer_id is not null and p_discount_rule_id is not null then
    select
      coalesce((
        select count(*)::integer
        from public.staff_orders
        where customer_id = p_customer_id
          and discount_rule_id = p_discount_rule_id
      ), 0)
      + coalesce((
        select count(*)::integer
        from public.sessions
        where ticket_customer_id = p_customer_id
          and ticket_discount_rule_id = p_discount_rule_id
      ), 0)
    into v_usage_count;

    if v_usage_count >= p_per_customer_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_rule_price_rule_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text", "p_requested_price_rule_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_player_count" integer, "p_subtotal" integer, "p_requested_ticket_type" "text", "p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_discount_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    p_rule_game_id is null
    or nullif(btrim(coalesce(p_requested_game_id, '')), '') is null
    or exists (
      select 1
      from public.staff_games g
      where g.id = p_rule_game_id
        and (
          g.id::text = btrim(coalesce(p_requested_game_id, ''))
          or lower(g.slug) = lower(btrim(coalesce(p_requested_game_id, '')))
        )
    );
$$;


ALTER FUNCTION "public"."staff_discount_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_employee_directory"() RETURNS TABLE("profile_id" "uuid", "employee_code" "text", "attendance_number" "text", "legal_name" "text", "job_title" "text", "department" "text", "main_work_location" "text", "employment_type" "text", "contract_status" "text", "active" boolean, "kiosk_access_role" "text", "kiosk_pin_configured_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
  select employee.profile_id,
         employee.employee_code,
         employee.attendance_number,
         employee.legal_name,
         employee.job_title,
         employee.department,
         employee.main_work_location,
         employee.employment_type,
         employee.contract_status,
         employee.active,
         employee.kiosk_access_role,
         employee.kiosk_pin_configured_at
  from public.staff_employee_profiles as employee
  where employee.deleted_at is null
    and public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
  order by employee.legal_name nulls last, employee.employee_code nulls last
$$;


ALTER FUNCTION "public"."staff_employee_directory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_get_player_achievement_history"("p_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_sessions jsonb;
  v_results jsonb;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null or not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  select coalesce(jsonb_agg(session_row.payload order by session_row.session_date, session_row.start_time), '[]'::jsonb)
  into v_sessions
  from (
    select
      sessions.date as session_date,
      sessions.start_time,
      jsonb_build_object(
        'booking_type', sessions.booking_type,
        'challenge_status', sessions.challenge_status,
        'challenge_target_id', sessions.challenge_target_id,
        'club_id', sessions.club_id,
        'confirmed_game_id', sessions.confirmed_game_id,
        'date', sessions.date,
        'game_options', sessions.game_options,
        'owner_id', sessions.owner_id,
        'start_time', sessions.start_time,
        'status', sessions.status,
        'ticket_type', sessions.ticket_type,
        'session_participants', coalesce((
          select jsonb_agg(jsonb_build_object(
            'accuracy_percent', participant.accuracy_percent,
            'checked_in', participant.checked_in,
            'escape_duration_seconds', participant.escape_duration_seconds,
            'placement', participant.placement,
            'profile_id', participant.profile_id,
            'score', participant.score
          ) order by participant.joined_at)
          from public.session_participants participant
          where participant.session_id = sessions.id
            and participant.deleted_at is null
        ), '[]'::jsonb)
      ) as payload
    from public.sessions
    where sessions.deleted_at is null
      and (
        sessions.owner_id = p_profile_id
        or exists (
          select 1
          from public.session_participants selected_participant
          where selected_participant.session_id = sessions.id
            and selected_participant.profile_id = p_profile_id
            and selected_participant.deleted_at is null
        )
      )
    order by sessions.date, sessions.start_time
    limit 500
  ) session_row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'accuracy_percent', result.accuracy_percent,
    'captured_at', result.captured_at,
    'game_slug', result.game_slug,
    'id', result.id,
    'matched_participant_id', result.matched_participant_id,
    'score', result.score
  ) order by result.captured_at), '[]'::jsonb)
  into v_results
  from public.venue_game_results result
  where result.profile_id = p_profile_id;

  return jsonb_build_object(
    'profileId', p_profile_id,
    'sessions', v_sessions,
    'venueResults', v_results
  );
end;
$$;


ALTER FUNCTION "public"."staff_get_player_achievement_history"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_get_player_stat_overrides"("p_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rows jsonb;
  v_loyalty_points integer;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  select profiles.loyalty_points_total
  into v_loyalty_points
  from public.profiles
  where profiles.id = p_profile_id
    and profiles.deleted_at is null;

  if not found then
    raise exception 'Profile not found.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'scope', overrides.scope,
        'sessionsJoined', overrides.sessions_joined,
        'gamesJoined', overrides.games_joined,
        'wins', overrides.wins,
        'bestPerformerCount', overrides.best_performer_count,
        'totalScore', overrides.total_score,
        'bestScore', overrides.best_score,
        'averageAccuracy', overrides.average_accuracy,
        'totalProjectiles', overrides.total_projectiles,
        'totalMovementMeters', overrides.total_movement_meters,
        'bestEscapeDurationSeconds', overrides.best_escape_duration_seconds
      ))
      order by overrides.scope
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.player_stat_overrides overrides
  where overrides.profile_id = p_profile_id;

  return jsonb_build_object(
    'profileId', p_profile_id,
    'loyaltyPoints', coalesce(v_loyalty_points, 0),
    'overrides', v_rows
  );
end;
$$;


ALTER FUNCTION "public"."staff_get_player_stat_overrides"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_hr_create_employee_record"("p_actor_user_id" "uuid", "p_full_name" "text", "p_personal_email" "text", "p_personal_phone" "text", "p_employment_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'auth', 'extensions'
    AS $_$
declare
  v_actor_email text;
  v_actor_role text;
  v_employee public.staff_employee_profiles;
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_personal_email text := nullif(lower(btrim(coalesce(p_personal_email, ''))), '');
  v_personal_phone text := nullif(btrim(coalesce(p_personal_phone, '')), '');
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

  insert into public.staff_employee_profiles (
    profile_id,
    active,
    created_by,
    employment_type,
    job_title,
    legal_name,
    personal_email,
    personal_phone
  ) values (
    extensions.gen_random_uuid(),
    true,
    p_actor_user_id,
    p_employment_type,
    'Employee',
    v_full_name,
    v_personal_email,
    v_personal_phone
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
    v_employee.profile_id,
    'staff_employee_profiles',
    jsonb_build_object(
      'employment_type', p_employment_type,
      'full_name', v_full_name,
      'independent_employee_record', true
    )
  );

  return jsonb_build_object('employee', to_jsonb(v_employee));
end;
$_$;


ALTER FUNCTION "public"."staff_hr_create_employee_record"("p_actor_user_id" "uuid", "p_full_name" "text", "p_personal_email" "text", "p_personal_phone" "text", "p_employment_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_actor uuid := private.current_staff_kiosk_operator_profile_id();
  v_session uuid := private.current_staff_kiosk_session_id();
  v_role text := private.current_staff_kiosk_role_key();
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_entity_id uuid;
  v_changed_fields text[] := array[]::text[];
begin
  if v_actor is null or v_session is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  begin
    v_entity_id := coalesce(nullif(v_row ->> 'id', ''), nullif(v_row ->> 'profile_id', ''))::uuid;
  exception when others then
    v_entity_id := null;
  end;

  select coalesce(array_agg(key order by key), array[]::text[])
  into v_changed_fields
  from (
    select fields.key
    from jsonb_object_keys(v_old || v_new) as fields(key)
    where v_old -> fields.key is distinct from v_new -> fields.key
  ) as changed;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_session_id,
    operator_role,
    action,
    entity_type,
    entity_id,
    new_value
  )
  values (
    v_actor,
    (select auth.uid()),
    v_session,
    v_role,
    'kiosk_' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('changed_fields', to_jsonb(v_changed_fields))
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."staff_kiosk_audit_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_configure_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid", "p_pin" "text", "p_access_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'extensions', 'vault'
    AS $_$
declare
  v_actor_email text;
  v_actor_role text;
  v_actor_rank integer;
  v_duplicate_profile uuid;
  v_target_name text;
  v_pin_secret_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{6}$' then
    raise exception 'PIN must contain exactly six digits.';
  end if;
  if p_access_role not in ('manager', 'staff') then
    raise exception 'Choose Manager or Staff access.';
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
    raise exception 'Sign in with an individual Owner or Admin account to manage employee PINs.';
  end if;
  if p_actor_profile_id is distinct from p_actor_user_id then
    raise exception 'The PIN administrator identity is invalid.';
  end if;

  v_actor_rank := public.staff_role_rank(v_actor_role, v_actor_email);
  if v_actor_rank < 100 then
    raise exception 'Administrator access required.';
  end if;

  select coalesce(employee.legal_name, employee.employee_code, 'Employee')
  into v_target_name
  from public.staff_employee_profiles as employee
  where employee.profile_id = p_profile_id
    and employee.active = true
    and employee.deleted_at is null;

  if v_target_name is null then
    raise exception 'Choose an active employee HR file.';
  end if;

  select credential.profile_id
  into v_duplicate_profile
  from private.staff_kiosk_pin_credentials as credential
  where credential.profile_id <> p_profile_id
    and extensions.crypt(p_pin, credential.pin_hash) = credential.pin_hash
  limit 1;

  if v_duplicate_profile is not null then
    raise exception 'This PIN is already assigned to another employee.';
  end if;

  select credential.pin_secret_id
  into v_pin_secret_id
  from private.staff_kiosk_pin_credentials as credential
  where credential.profile_id = p_profile_id;

  if v_pin_secret_id is null then
    select vault.create_secret(
      p_pin,
      'staff-kiosk-pin-' || p_profile_id::text,
      'Encrypted six-digit VRena employee PIN'
    ) into v_pin_secret_id;
  else
    perform vault.update_secret(
      v_pin_secret_id,
      p_pin,
      'staff-kiosk-pin-' || p_profile_id::text,
      'Encrypted six-digit VRena employee PIN'
    );
  end if;

  insert into private.staff_kiosk_pin_credentials (
    profile_id, pin_hash, pin_secret_id, access_role, failed_attempts,
    locked_until, configured_by, updated_at
  ) values (
    p_profile_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    v_pin_secret_id,
    p_access_role,
    0,
    null,
    p_actor_user_id,
    now()
  )
  on conflict (profile_id) do update
  set pin_hash = excluded.pin_hash,
      pin_secret_id = excluded.pin_secret_id,
      access_role = excluded.access_role,
      failed_attempts = 0,
      locked_until = null,
      configured_by = excluded.configured_by,
      updated_at = now();

  update public.staff_employee_profiles
  set kiosk_access_role = p_access_role,
      kiosk_pin_configured_at = now(),
      updated_at = now()
  where profile_id = p_profile_id;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(), revoked_reason = 'pin_changed'
  where operator_profile_id = p_profile_id and revoked_at is null;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_role, action, entity_type, entity_id, new_value
  ) values (
    p_actor_user_id, p_actor_user_id,
    case when v_actor_rank >= 120 then 'owner' else 'admin' end,
    'kiosk_pin_configured', 'staff_employee_profiles', p_profile_id,
    jsonb_build_object('access_role', p_access_role, 'pin_length', 6)
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'name', v_target_name,
    'access_role', p_access_role,
    'configured_at', now()
  );
end;
$_$;


ALTER FUNCTION "public"."staff_kiosk_configure_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid", "p_pin" "text", "p_access_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_reveal_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'vault'
    AS $$
declare
  v_actor_email text;
  v_actor_role text;
  v_actor_rank integer;
  v_pin text;
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

  if v_actor_email is null or v_actor_email = 'contact@vre-vietnam.com' then
    raise exception 'An individual staff account is required.';
  end if;
  if p_actor_profile_id is distinct from p_actor_user_id then
    raise exception 'The PIN viewer identity is invalid.';
  end if;

  v_actor_rank := public.staff_role_rank(v_actor_role, v_actor_email);
  if v_actor_rank < 100 and lower(coalesce(v_actor_role, '')) <> 'cashier' then
    raise exception 'Owner, Admin, or Office Staff access required.';
  end if;

  select decrypted.decrypted_secret
  into v_pin
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
  join vault.decrypted_secrets as decrypted on decrypted.id = credential.pin_secret_id
  where credential.profile_id = p_profile_id
    and employee.active = true
    and employee.deleted_at is null;

  if v_pin is null then
    return jsonb_build_object('available', false);
  end if;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_role, action, entity_type, entity_id
  ) values (
    p_actor_user_id, p_actor_user_id,
    case
      when v_actor_rank >= 120 then 'owner'
      when v_actor_rank >= 100 then 'admin'
      else 'cashier'
    end,
    'kiosk_pin_revealed', 'staff_employee_profiles', p_profile_id
  );

  return jsonb_build_object('available', true, 'pin', v_pin);
end;
$$;


ALTER FUNCTION "public"."staff_kiosk_reveal_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_revoke_session"("p_actor_user_id" "uuid", "p_token_hash" "text", "p_reason" "text" DEFAULT 'locked'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_session private.staff_kiosk_operator_sessions%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update private.staff_kiosk_operator_sessions
  set revoked_at = now(),
      revoked_reason = left(coalesce(nullif(p_reason, ''), 'locked'), 80)
  where auth_user_id = p_actor_user_id
    and token_hash = p_token_hash
    and revoked_at is null
  returning * into v_session;

  if v_session.id is null then
    return false;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_session_id,
    operator_role,
    action,
    entity_type,
    entity_id
  )
  values (
    v_session.operator_profile_id,
    p_actor_user_id,
    v_session.id,
    v_session.access_role,
    'kiosk_locked',
    'staff_employee_profiles',
    v_session.operator_profile_id
  );
  return true;
end;
$$;


ALTER FUNCTION "public"."staff_kiosk_revoke_session"("p_actor_user_id" "uuid", "p_token_hash" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_touch_session"("p_actor_user_id" "uuid", "p_token_hash" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
declare
  v_updated integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update private.staff_kiosk_operator_sessions
  set last_activity_at = now()
  where auth_user_id = p_actor_user_id
    and token_hash = p_token_hash
    and revoked_at is null
    and last_activity_at > now() - interval '5 minutes'
    and expires_at > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;


ALTER FUNCTION "public"."staff_kiosk_touch_session"("p_actor_user_id" "uuid", "p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'extensions'
    AS $_$
declare
  v_actor_email text;
  v_attempt private.staff_kiosk_pin_attempts%rowtype;
  v_credential private.staff_kiosk_pin_credentials%rowtype;
  v_attempt_hash text := repeat('0', 64);
  v_device_hash text;
  v_session_id uuid;
  v_name text;
  v_employee_code text;
  v_job_title text;
  v_next_attempts integer;
  v_locked_until timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{6}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select lower(email) into v_actor_email from auth.users where id = p_actor_user_id;
  if v_actor_email <> 'contact@vre-vietnam.com' then
    raise exception 'The shared store login is required.';
  end if;

  v_device_hash := coalesce(nullif(p_user_agent_hash, ''), repeat('0', 64));
  if v_device_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into private.staff_kiosk_pin_attempts (auth_user_id, user_agent_hash)
  values (p_actor_user_id, v_attempt_hash)
  on conflict (auth_user_id, user_agent_hash) do nothing;

  select attempts.* into v_attempt
  from private.staff_kiosk_pin_attempts as attempts
  where attempts.auth_user_id = p_actor_user_id
    and attempts.user_agent_hash = v_attempt_hash
  for update;

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_attempt.locked_until);
  end if;

  select credential.* into v_credential
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
  where employee.active = true
    and employee.deleted_at is null
    and employee.kiosk_pin_configured_at is not null
    and employee.kiosk_access_role = credential.access_role
    and private.staff_kiosk_department_is_eligible(employee.department)
    and extensions.crypt(p_pin, credential.pin_hash) = credential.pin_hash
  limit 1;

  if not found then
    v_next_attempts := v_attempt.failed_attempts + 1;
    v_locked_until := case when v_next_attempts >= 5 then now() + interval '15 minutes' else null end;
    update private.staff_kiosk_pin_attempts
    set failed_attempts = case when v_next_attempts >= 5 then 0 else v_next_attempts end,
        locked_until = v_locked_until,
        updated_at = now()
    where auth_user_id = p_actor_user_id and user_agent_hash = v_attempt_hash;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_locked_until is null then 'incorrect' else 'locked' end,
      'attempts_remaining', greatest(0, 5 - v_next_attempts),
      'locked_until', v_locked_until
    );
  end if;

  update private.staff_kiosk_pin_attempts
  set failed_attempts = 0, locked_until = null, updated_at = now()
  where auth_user_id = p_actor_user_id and user_agent_hash = v_attempt_hash;

  -- Existing station sessions stay active. Lock/logout RPCs revoke only the
  -- station token that the operator actually presented.
  insert into private.staff_kiosk_operator_sessions (
    auth_user_id, operator_profile_id, access_role, token_hash, user_agent_hash
  ) values (
    p_actor_user_id, v_credential.profile_id, v_credential.access_role,
    p_token_hash, v_device_hash
  ) returning id into v_session_id;

  select coalesce(employee.legal_name, employee.employee_code, 'Employee'),
         employee.employee_code,
         employee.job_title
  into v_name, v_employee_code, v_job_title
  from public.staff_employee_profiles as employee
  where employee.profile_id = v_credential.profile_id;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_session_id, operator_role,
    action, entity_type, entity_id
  ) values (
    p_actor_user_id, p_actor_user_id, v_session_id, v_credential.access_role,
    'kiosk_unlocked', 'staff_employee_profiles', v_credential.profile_id
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'profile_id', v_credential.profile_id,
    'employee_code', v_employee_code,
    'name', v_name,
    'job_title', v_job_title,
    'access_role', v_credential.access_role,
    'avatar_emoji', null,
    'avatar_initials', null,
    'avatar_color', '#f3f4f6',
    'avatar_text_color', '#111827',
    'expires_at', now() + interval '12 hours'
  );
end;
$_$;


ALTER FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_profile_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'extensions'
    AS $_$
declare
  v_actor_email text;
  v_credential private.staff_kiosk_pin_credentials%rowtype;
  v_session_id uuid;
  v_name text;
  v_avatar_emoji text;
  v_avatar_initials text;
  v_avatar_color text;
  v_avatar_text_color text;
  v_next_attempts integer;
  v_locked_until timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{4}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select lower(email) into v_actor_email from auth.users where id = p_actor_user_id;
  if v_actor_email <> 'contact@vre-vietnam.com' then
    raise exception 'The shared store login is required.';
  end if;

  select credential.*
  into v_credential
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
  where credential.profile_id = p_profile_id
    and employee.active = true
    and employee.deleted_at is null
  for update of credential;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_credential.locked_until is not null and v_credential.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_credential.locked_until);
  end if;

  if extensions.crypt(p_pin, v_credential.pin_hash) <> v_credential.pin_hash then
    v_next_attempts := v_credential.failed_attempts + 1;
    v_locked_until := case when v_next_attempts >= 5 then now() + interval '15 minutes' else null end;
    update private.staff_kiosk_pin_credentials
    set failed_attempts = case when v_next_attempts >= 5 then 0 else v_next_attempts end,
        locked_until = v_locked_until,
        updated_at = now()
    where profile_id = p_profile_id;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_locked_until is null then 'incorrect' else 'locked' end,
      'attempts_remaining', greatest(0, 5 - v_next_attempts),
      'locked_until', v_locked_until
    );
  end if;

  update private.staff_kiosk_pin_credentials
  set failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where profile_id = p_profile_id;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(),
      revoked_reason = 'operator_switched'
  where auth_user_id = p_actor_user_id
    and revoked_at is null;

  insert into private.staff_kiosk_operator_sessions (
    auth_user_id,
    operator_profile_id,
    access_role,
    token_hash,
    user_agent_hash
  )
  values (
    p_actor_user_id,
    p_profile_id,
    v_credential.access_role,
    p_token_hash,
    nullif(p_user_agent_hash, '')
  )
  returning id into v_session_id;

  select
    coalesce(employee.legal_name, profiles.full_name, profiles.nickname, employee.employee_code, 'Employee'),
    profiles.avatar_emoji,
    profiles.avatar_initials,
    profiles.avatar_color,
    profiles.avatar_text_color
  into v_name, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color
  from public.staff_employee_profiles as employee
  join public.profiles as profiles on profiles.id = employee.profile_id
  where employee.profile_id = p_profile_id;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_session_id,
    operator_role,
    action,
    entity_type,
    entity_id
  )
  values (
    p_profile_id,
    p_actor_user_id,
    v_session_id,
    v_credential.access_role,
    'kiosk_unlocked',
    'staff_employee_profiles',
    p_profile_id
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'profile_id', p_profile_id,
    'name', v_name,
    'access_role', v_credential.access_role,
    'avatar_emoji', v_avatar_emoji,
    'avatar_initials', v_avatar_initials,
    'avatar_color', v_avatar_color,
    'avatar_text_color', v_avatar_text_color,
    'expires_at', now() + interval '12 hours'
  );
end;
$_$;


ALTER FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_profile_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_list_player_session_options"("p_profile_id" "uuid", "p_month" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_month_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_sessions jsonb;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null or not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'alreadyAdded',
      session_row.owner_id = p_profile_id
      or exists (
        select 1
        from public.session_participants participant
        where participant.session_id = session_row.id
          and participant.profile_id = p_profile_id
          and participant.deleted_at is null
      ),
    'bookingType', session_row.booking_type,
    'date', session_row.date,
    'gameName', session_row.game_name,
    'id', session_row.id,
    'name', session_row.name,
    'startTime', session_row.start_time,
    'status', session_row.status,
    'ticketType', session_row.ticket_type
  ) order by session_row.date, session_row.start_time, session_row.name), '[]'::jsonb)
  into v_sessions
  from (
    select
      sessions.id,
      sessions.owner_id,
      sessions.name,
      sessions.date,
      sessions.start_time,
      sessions.status,
      sessions.booking_type,
      sessions.ticket_type,
      staff_games.name as game_name
    from public.sessions
    left join public.staff_games on staff_games.slug = sessions.confirmed_game_id
    where sessions.deleted_at is null
      and sessions.date >= v_month_start
      and sessions.date < (v_month_start + interval '1 month')::date
  ) session_row;

  return v_sessions;
end;
$$;


ALTER FUNCTION "public"."staff_list_player_session_options"("p_profile_id" "uuid", "p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_loyalty_audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_action text;
  v_actor uuid := (select auth.uid());
begin
  if TG_OP = 'INSERT' then
    v_action := 'loyalty_rule_created';
  elsif old.active = true and new.active = false then
    v_action := 'loyalty_rule_deactivated';
  else
    v_action := 'loyalty_rule_edited';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    v_action,
    TG_TABLE_NAME,
    new.id,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new)
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."staff_loyalty_audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_loyalty_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    p_rule_game_id is null
    or nullif(btrim(coalesce(p_requested_game_id, '')), '') is null
    or exists (
      select 1
      from public.staff_games g
      where g.id = p_rule_game_id
        and (
          g.id::text = btrim(coalesce(p_requested_game_id, ''))
          or lower(g.slug) = lower(btrim(coalesce(p_requested_game_id, '')))
        )
    );
$$;


ALTER FUNCTION "public"."staff_loyalty_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_order_loyalty_award_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if TG_OP = 'UPDATE' and old.payment_status = 'paid' then
    return new;
  end if;

  perform public.award_staff_order_loyalty(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_order_loyalty_award_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_orders_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer DEFAULT 120, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 250);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_orders jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_total_count integer := 0;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with filtered_orders as (
    select o.*
    from public.staff_orders o
    where o.booking_date between v_start and v_end
      and (v_status is null or o.order_status = v_status)
      and (
        v_search is null
        or lower(coalesce(o.order_number, '') || ' ' || coalesce(o.customer_name, '') || ' ' || coalesce(o.customer_phone, '') || ' ' || coalesce(o.customer_email, '')) like '%' || v_search || '%'
      )
  )
  select count(*)::integer
  into v_total_count
  from filtered_orders;

  with filtered_orders as (
    select o.*
    from public.staff_orders o
    where o.booking_date between v_start and v_end
      and (v_status is null or o.order_status = v_status)
      and (
        v_search is null
        or lower(coalesce(o.order_number, '') || ' ' || coalesce(o.customer_name, '') || ' ' || coalesce(o.customer_phone, '') || ' ' || coalesce(o.customer_email, '')) like '%' || v_search || '%'
      )
    order by o.booking_date desc, o.booking_time desc, o.created_at desc
    limit v_limit
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(fo) order by fo.booking_date desc, fo.booking_time desc, fo.created_at desc), '[]'::jsonb)
  into v_orders
  from filtered_orders fo;

  with selected_order_ids as (
    select o.id
    from public.staff_orders o
    where o.booking_date between v_start and v_end
      and (v_status is null or o.order_status = v_status)
      and (
        v_search is null
        or lower(coalesce(o.order_number, '') || ' ' || coalesce(o.customer_name, '') || ' ' || coalesce(o.customer_phone, '') || ' ' || coalesce(o.customer_email, '')) like '%' || v_search || '%'
      )
    order by o.booking_date desc, o.booking_time desc, o.created_at desc
    limit v_limit
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at asc, p.id asc), '[]'::jsonb)
  into v_payments
  from public.staff_order_payments p
  where p.order_id in (select id from selected_order_ids);

  return jsonb_build_object(
    'orders', coalesce(v_orders, '[]'::jsonb),
    'payments', coalesce(v_payments, '[]'::jsonb),
    'totalCount', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;


ALTER FUNCTION "public"."staff_orders_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_search" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_player_behavior_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date" DEFAULT NULL::"date", "p_compare_end" "date" DEFAULT NULL::"date", "p_player_limit" integer DEFAULT 12) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_compare_start date := case
    when p_compare_start is null or p_compare_end is null then null
    else least(p_compare_start, p_compare_end)
  end;
  v_compare_end date := case
    when p_compare_start is null or p_compare_end is null then null
    else greatest(p_compare_start, p_compare_end)
  end;
  v_player_limit integer := least(greatest(coalesce(p_player_limit, 12), 1), 50);
  v_payload jsonb;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with ranges as (
    select 'current'::text as range_key, v_start as range_start, v_end as range_end
    union all
    select 'comparison', v_compare_start, v_compare_end
    where v_compare_start is not null and v_compare_end is not null
  ),
  scoped_activity as (
    select
      ranges.range_key,
      ranges.range_start,
      ranges.range_end,
      sessions.id as session_id,
      sessions.date as session_date,
      sessions.start_time,
      coalesce(
        nullif(sessions.confirmed_game_id, ''),
        nullif(sessions.game_options[1], ''),
        'unassigned'
      ) as game_key,
      participant.profile_id,
      private.staff_report_profile_is_excluded(participant.profile_id) as is_report_excluded,
      coalesce(participant.checked_in, false) as checked_in,
      participant.score,
      participant.accuracy_percent,
      participant.hits,
      participant.movement_meters,
      participant.escape_duration_seconds,
      participant.joined_at,
      participant.updated_at,
      (
        sessions.date::timestamp + sessions.start_time
        <= timezone('Asia/Ho_Chi_Minh', now())
      ) as is_due
    from ranges
    join public.sessions
      on sessions.date between ranges.range_start and ranges.range_end
      and sessions.deleted_at is null
      and sessions.status <> 'cancelled'
    join public.session_participants participant
      on participant.session_id = sessions.id
      and participant.deleted_at is null
    join public.profiles profile
      on profile.id = participant.profile_id
      and profile.deleted_at is null
      and not coalesce(profile.is_seed_demo, false)
      and public.staff_role_rank(profile.role, profile.email) = 0
  ),
  player_rollup as (
    select
      activity.range_key,
      activity.range_start,
      activity.profile_id,
      count(*)::integer as reservations,
      count(*) filter (where activity.checked_in and not activity.is_report_excluded)::integer as check_ins,
      min(activity.session_date) filter (where activity.checked_in and not activity.is_report_excluded) as first_visit,
      max(activity.session_date) filter (where activity.checked_in and not activity.is_report_excluded) as last_visit,
      avg(activity.score) filter (where activity.checked_in and not activity.is_report_excluded and activity.score is not null) as average_score,
      avg(activity.accuracy_percent) filter (where activity.checked_in and not activity.is_report_excluded and activity.accuracy_percent is not null) as average_accuracy,
      exists (
        select 1
        from public.session_participants prior_participant
        join public.sessions prior_session
          on prior_session.id = prior_participant.session_id
          and prior_session.deleted_at is null
          and prior_session.status <> 'cancelled'
        where prior_participant.profile_id = activity.profile_id
          and prior_participant.deleted_at is null
          and prior_participant.checked_in is true
          and prior_session.date < activity.range_start
      ) as had_prior_visit
    from scoped_activity activity
    group by activity.range_key, activity.range_start, activity.profile_id
  ),
  activity_summary as (
    select
      ranges.range_key,
      count(activity.profile_id)::integer as reservations,
      count(activity.profile_id) filter (where activity.is_due)::integer as due_reservations,
      count(activity.profile_id) filter (where activity.checked_in and not activity.is_report_excluded)::integer as completed_visits,
      count(distinct activity.profile_id)::integer as engaged_players,
      count(distinct activity.profile_id) filter (where activity.checked_in and not activity.is_report_excluded)::integer as checked_in_players,
      count(activity.profile_id) filter (
        where activity.checked_in
          and not activity.is_report_excluded
          and (
            activity.score is not null
            or activity.accuracy_percent is not null
            or activity.hits is not null
            or activity.movement_meters is not null
            or activity.escape_duration_seconds is not null
          )
      )::integer as result_rows,
      avg(activity.score) filter (where activity.checked_in and not activity.is_report_excluded and activity.score is not null) as average_score,
      avg(activity.accuracy_percent) filter (where activity.checked_in and not activity.is_report_excluded and activity.accuracy_percent is not null) as average_accuracy,
      max(coalesce(activity.updated_at, activity.joined_at)) filter (where not activity.is_report_excluded) as latest_source_at
    from ranges
    left join scoped_activity activity on activity.range_key = ranges.range_key
    group by ranges.range_key
  ),
  player_summary as (
    select
      ranges.range_key,
      count(player.profile_id) filter (where player.check_ins > 0 and player.had_prior_visit)::integer as returning_players,
      count(player.profile_id) filter (where player.check_ins > 0 and not player.had_prior_visit)::integer as first_time_players,
      count(player.profile_id) filter (where player.check_ins >= 2)::integer as repeat_players
    from ranges
    left join player_rollup player on player.range_key = ranges.range_key
    group by ranges.range_key
  ),
  social_summary as (
    select
      ranges.range_key,
      (
        select count(*)::integer
        from public.session_messages message
        join public.profiles profile on profile.id = message.author_id
        where message.deleted_at is null
          and profile.deleted_at is null
          and not coalesce(profile.is_seed_demo, false)
      and public.staff_role_rank(profile.role, profile.email) = 0
          and not private.staff_report_profile_is_excluded(profile.id)
          and (message.created_at at time zone 'Asia/Ho_Chi_Minh')::date
            between ranges.range_start and ranges.range_end
      ) as messages,
      (
        select count(*)::integer
        from public.club_members member
        join public.profiles profile on profile.id = member.profile_id
        where member.deleted_at is null
          and member.status = 'approved'
          and profile.deleted_at is null
          and not coalesce(profile.is_seed_demo, false)
      and public.staff_role_rank(profile.role, profile.email) = 0
          and not private.staff_report_profile_is_excluded(profile.id)
          and (member.joined_at at time zone 'Asia/Ho_Chi_Minh')::date
            between ranges.range_start and ranges.range_end
      ) as club_joins
    from ranges
  ),
  summaries as (
    select
      activity.range_key,
      jsonb_build_object(
        'engagedPlayers', activity.engaged_players,
        'checkedInPlayers', activity.checked_in_players,
        'reservations', activity.reservations,
        'dueReservations', activity.due_reservations,
        'completedVisits', activity.completed_visits,
        'returningPlayers', coalesce(players.returning_players, 0),
        'firstTimePlayers', coalesce(players.first_time_players, 0),
        'repeatPlayers', coalesce(players.repeat_players, 0),
        'attendanceRate', case
          when activity.due_reservations = 0 then 0
          else round((activity.completed_visits::numeric / activity.due_reservations) * 100, 1)
        end,
        'repeatRate', case
          when activity.checked_in_players = 0 then 0
          else round((coalesce(players.repeat_players, 0)::numeric / activity.checked_in_players) * 100, 1)
        end,
        'averageVisitsPerPlayer', case
          when activity.checked_in_players = 0 then 0
          else round(activity.completed_visits::numeric / activity.checked_in_players, 1)
        end,
        'averageScore', round(coalesce(activity.average_score, 0)::numeric, 0),
        'averageAccuracy', round(coalesce(activity.average_accuracy, 0)::numeric, 1),
        'resultRows', activity.result_rows,
        'resultCoverage', case
          when activity.completed_visits = 0 then 0
          else round((activity.result_rows::numeric / activity.completed_visits) * 100, 1)
        end,
        'messages', social.messages,
        'clubJoins', social.club_joins,
        'socialActions', social.messages + social.club_joins,
        'latestSourceAt', activity.latest_source_at
      ) as summary
    from activity_summary activity
    join player_summary players on players.range_key = activity.range_key
    join social_summary social on social.range_key = activity.range_key
  ),
  series_days as (
    select generate_series(v_start, least(v_end, v_start + 179), interval '1 day')::date as day
  ),
  activity_series as (
    select
      day.day,
      count(activity.profile_id)::integer as reservations,
      count(activity.profile_id) filter (where activity.checked_in and not activity.is_report_excluded)::integer as check_ins,
      count(distinct activity.profile_id)::integer as engaged_players
    from series_days day
    left join scoped_activity activity
      on activity.range_key = 'current'
      and activity.session_date = day.day
    group by day.day
  ),
  weekdays as (
    select generate_series(1, 7)::integer as weekday
  ),
  dayparts as (
    select * from (values
      ('morning'::text, 0, 11),
      ('afternoon'::text, 12, 16),
      ('evening'::text, 17, 23)
    ) as parts(daypart, start_hour, end_hour)
  ),
  peak_times as (
    select
      weekdays.weekday,
      dayparts.daypart,
      dayparts.start_hour,
      count(activity.profile_id) filter (where activity.checked_in and not activity.is_report_excluded)::integer as visits
    from weekdays
    cross join dayparts
    left join scoped_activity activity
      on activity.range_key = 'current'
      and extract(isodow from activity.session_date)::integer = weekdays.weekday
      and extract(hour from activity.start_time)::integer between dayparts.start_hour and dayparts.end_hour
    group by weekdays.weekday, dayparts.daypart, dayparts.start_hour
    order by weekdays.weekday, dayparts.start_hour
  ),
  game_demand as (
    select
      activity.game_key,
      coalesce(game.name, initcap(replace(activity.game_key, '-', ' ')), 'Not assigned') as game_name,
      count(*)::integer as reservations,
      count(*) filter (where activity.checked_in and not activity.is_report_excluded)::integer as visits,
      count(distinct activity.session_id)::integer as sessions
    from scoped_activity activity
    left join public.staff_games game
      on game.slug = activity.game_key
      or game.id::text = activity.game_key
    where activity.range_key = 'current'
    group by activity.game_key, game.name
    order by visits desc, reservations desc, game_name asc
    limit 6
  ),
  player_game_counts as (
    select
      activity.profile_id,
      activity.game_key,
      coalesce(game.name, initcap(replace(activity.game_key, '-', ' ')), 'Not assigned') as game_name,
      count(*) filter (where activity.checked_in and not activity.is_report_excluded)::integer as visits,
      row_number() over (
        partition by activity.profile_id
        order by count(*) filter (where activity.checked_in and not activity.is_report_excluded) desc,
          count(*) desc,
          coalesce(game.name, initcap(replace(activity.game_key, '-', ' ')), 'Not assigned') asc
      ) as game_rank
    from scoped_activity activity
    left join public.staff_games game
      on game.slug = activity.game_key
      or game.id::text = activity.game_key
    where activity.range_key = 'current'
    group by activity.profile_id, activity.game_key, game.name
  ),
  player_rows as (
    select
      player.profile_id,
      coalesce(
        nullif(profile.nickname, ''),
        nullif(profile.full_name, ''),
        nullif(profile.anonymous_callsign, ''),
        'Player'
      ) as display_name,
      player.reservations,
      player.check_ins,
      player.first_visit,
      player.last_visit,
      round(coalesce(player.average_score, 0)::numeric, 0) as average_score,
      round(coalesce(player.average_accuracy, 0)::numeric, 1) as average_accuracy,
      coalesce(favorite.game_name, 'Not assigned') as favorite_game,
      case
        when player.check_ins >= 3 then 'loyal'
        when player.check_ins >= 2 then 'repeat'
        when player.check_ins = 1 and player.had_prior_visit then 'returning'
        when player.check_ins = 1 then 'new'
        else 'booked'
      end as segment
    from player_rollup player
    join public.profiles profile on profile.id = player.profile_id
    left join player_game_counts favorite
      on favorite.profile_id = player.profile_id
      and favorite.game_rank = 1
    where player.range_key = 'current'
    order by player.check_ins desc, player.reservations desc, player.last_visit desc nulls last, display_name asc
    limit v_player_limit
  )
  select jsonb_build_object(
    'summary', coalesce((select summary from summaries where range_key = 'current'), '{}'::jsonb),
    'comparisonSummary', coalesce((select summary from summaries where range_key = 'comparison'), '{}'::jsonb),
    'activitySeries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day::text,
        'reservations', reservations,
        'checkIns', check_ins,
        'engagedPlayers', engaged_players
      ) order by day)
      from activity_series
    ), '[]'::jsonb),
    'peakTimes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', weekday,
        'daypart', daypart,
        'visits', visits
      ) order by weekday, start_hour)
      from peak_times
    ), '[]'::jsonb),
    'gameDemand', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameKey', game_key,
        'gameName', game_name,
        'reservations', reservations,
        'visits', visits,
        'sessions', sessions
      ) order by visits desc, reservations desc, game_name)
      from game_demand
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profileId', profile_id,
        'displayName', display_name,
        'reservations', reservations,
        'checkIns', check_ins,
        'firstVisit', first_visit,
        'lastVisit', last_visit,
        'averageScore', average_score,
        'averageAccuracy', average_accuracy,
        'favoriteGame', favorite_game,
        'segment', segment
      ) order by check_ins desc, reservations desc, last_visit desc nulls last, display_name)
      from player_rows
    ), '[]'::jsonb),
    'dataQuality', jsonb_build_object(
      'timezone', 'Asia/Ho_Chi_Minh',
      'seriesCappedAtDays', 180,
      'sources', jsonb_build_array('sessions', 'session_participants', 'profiles', 'session_messages', 'club_members'),
      'trackedSignals', jsonb_build_array('reservations', 'check-ins', 'scores', 'accuracy', 'session messages', 'club joins'),
      'untrackedSignals', jsonb_build_array('page views', 'click paths', 'searches', 'session duration', 'device and acquisition source')
    )
  )
  into v_payload;

  return coalesce(v_payload, '{}'::jsonb);
end;
$$;


ALTER FUNCTION "public"."staff_player_behavior_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_player_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_product_analytics_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date" DEFAULT NULL::"date", "p_compare_end" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_compare_start date := case
    when p_compare_start is null or p_compare_end is null then null
    else least(p_compare_start, p_compare_end)
  end;
  v_compare_end date := case
    when p_compare_start is null or p_compare_end is null then null
    else greatest(p_compare_start, p_compare_end)
  end;
  v_payload jsonb;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with ranges as (
    select 'current'::text as range_key, v_start as range_start, v_end as range_end
    union all
    select 'comparison', v_compare_start, v_compare_end
    where v_compare_start is not null and v_compare_end is not null
  ),
  scoped_events as (
    select
      ranges.range_key,
      event.*
    from ranges
    join public.app_analytics_events event
      on (event.created_at at time zone 'Asia/Ho_Chi_Minh')::date
        between ranges.range_start and ranges.range_end
    where event.path !~ '^/(staff|hr|admin)(/|$)'
      and (
        event.profile_id is null
        or not exists (
          select 1
          from public.profiles analytics_profile
          where analytics_profile.id = event.profile_id
            and public.staff_role_rank(analytics_profile.role, analytics_profile.email) >= 20
        )
      )
      and not private.staff_report_profile_is_excluded(event.profile_id)
  ),
  summaries as (
    select
      ranges.range_key,
      count(distinct event.session_id)::integer as sessions,
      count(distinct event.client_id)::integer as visitors,
      count(distinct event.client_id) filter (where event.profile_id is not null)::integer as signed_in_visitors,
      count(*) filter (where event.event_name = 'page_view')::integer as page_views,
      count(*) filter (where event.event_name = 'search')::integer as searches,
      coalesce(sum(event.duration_seconds) filter (where event.event_name = 'engagement'), 0)::integer as engagement_seconds,
      max(event.created_at) as latest_event_at
    from ranges
    left join scoped_events event on event.range_key = ranges.range_key
    group by ranges.range_key
  ),
  summary_json as (
    select
      range_key,
      jsonb_build_object(
        'sessions', sessions,
        'visitors', visitors,
        'signedInVisitors', signed_in_visitors,
        'pageViews', page_views,
        'searches', searches,
        'engagementSeconds', engagement_seconds,
        'averageSessionSeconds', case when sessions = 0 then 0 else round(engagement_seconds::numeric / sessions, 0) end,
        'pagesPerSession', case when sessions = 0 then 0 else round(page_views::numeric / sessions, 1) end,
        'searchRate', case when sessions = 0 then 0 else round((searches::numeric / sessions) * 100, 1) end,
        'signedInShare', case when visitors = 0 then 0 else round((signed_in_visitors::numeric / visitors) * 100, 1) end,
        'latestEventAt', latest_event_at
      ) as summary
    from summaries
  ),
  series_days as (
    select generate_series(v_start, least(v_end, v_start + 179), interval '1 day')::date as day
  ),
  activity_series as (
    select
      day.day,
      count(*) filter (where event.event_name = 'page_view')::integer as page_views,
      count(distinct event.session_id)::integer as sessions,
      count(*) filter (where event.event_name = 'search')::integer as searches
    from series_days day
    left join scoped_events event
      on event.range_key = 'current'
      and (event.created_at at time zone 'Asia/Ho_Chi_Minh')::date = day.day
    group by day.day
  ),
  top_pages as (
    select
      event.path,
      count(*) filter (where event.event_name = 'page_view')::integer as page_views,
      count(distinct event.client_id) filter (where event.event_name = 'page_view')::integer as visitors,
      coalesce(sum(event.duration_seconds) filter (where event.event_name = 'engagement'), 0)::integer as engagement_seconds
    from scoped_events event
    where event.range_key = 'current'
    group by event.path
    having count(*) filter (where event.event_name = 'page_view') > 0
    order by page_views desc, visitors desc, event.path
    limit 8
  ),
  page_sequence as (
    select
      event.session_id,
      event.path as to_path,
      lag(event.path) over (partition by event.session_id order by event.created_at, event.id) as from_path
    from scoped_events event
    where event.range_key = 'current'
      and event.event_name = 'page_view'
  ),
  transitions as (
    select
      from_path,
      to_path,
      count(*)::integer as transitions
    from page_sequence
    where from_path is not null and from_path <> to_path
    group by from_path, to_path
    order by transitions desc, from_path, to_path
    limit 8
  ),
  device_mix as (
    select
      event.device_class,
      count(distinct event.session_id)::integer as sessions
    from scoped_events event
    where event.range_key = 'current'
      and event.event_name = 'page_view'
    group by event.device_class
    order by sessions desc, event.device_class
  ),
  raw_session_acquisition as (
    select distinct on (event.session_id)
      event.session_id,
      coalesce(nullif(event.acquisition_source, ''), nullif(event.referrer_host, ''), 'Direct') as source,
      coalesce(nullif(event.acquisition_medium, ''), case when event.referrer_host is null then 'direct' else 'referral' end) as medium
    from scoped_events event
    where event.range_key = 'current'
      and event.event_name = 'page_view'
    order by event.session_id, event.created_at, event.id
  ),
  session_acquisition as (
    select
      event.session_id,
      case
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('google', 'google ads', 'adwords') then 'Google Ads'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('facebook', 'fb', 'meta') then 'Facebook Ads'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) = 'instagram' then 'Instagram Ads'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('tiktok', 'tik tok') then 'TikTok Ads'
        when lower(event.source) in ('facebook', 'fb', 'meta') then 'Facebook'
        when lower(event.source) = 'instagram' then 'Instagram'
        when lower(event.source) in ('tiktok', 'tik tok') then 'TikTok'
        else event.source
      end as source,
      case
        when lower(event.medium) in ('social', 'organic', 'organic social', 'organic_social') then 'Organic social'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('google', 'google ads', 'adwords') then 'Paid search'
        when lower(event.medium) ~ '(paid|cpc|ppc)' then 'Paid social'
        else event.medium
      end as medium
    from raw_session_acquisition event
  ),
  acquisition_mix as (
    select source, medium, count(*)::integer as sessions
    from session_acquisition
    group by source, medium
    order by sessions desc, source
    limit 8
  ),
  search_surfaces as (
    select
      coalesce(nullif(event.search_surface, ''), 'Other') as surface,
      count(*)::integer as searches,
      round(avg(event.search_query_length)::numeric, 1) as average_query_length,
      round((avg(event.search_result_count) filter (where event.search_result_count is not null))::numeric, 1) as average_results
    from scoped_events event
    where event.range_key = 'current'
      and event.event_name = 'search'
    group by coalesce(nullif(event.search_surface, ''), 'Other')
    order by searches desc, surface
    limit 8
  )
  select jsonb_build_object(
    'summary', coalesce((select summary from summary_json where range_key = 'current'), '{}'::jsonb),
    'comparisonSummary', coalesce((select summary from summary_json where range_key = 'comparison'), '{}'::jsonb),
    'activitySeries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day::text,
        'pageViews', page_views,
        'sessions', sessions,
        'searches', searches
      ) order by day)
      from activity_series
    ), '[]'::jsonb),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', path,
        'pageViews', page_views,
        'visitors', visitors,
        'engagementSeconds', engagement_seconds
      ) order by page_views desc, visitors desc, path)
      from top_pages
    ), '[]'::jsonb),
    'transitions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fromPath', from_path,
        'toPath', to_path,
        'transitions', transitions
      ) order by transitions desc, from_path, to_path)
      from transitions
    ), '[]'::jsonb),
    'deviceMix', coalesce((
      select jsonb_agg(jsonb_build_object(
        'deviceClass', device_class,
        'sessions', sessions
      ) order by sessions desc, device_class)
      from device_mix
    ), '[]'::jsonb),
    'acquisitionMix', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', source,
        'medium', medium,
        'sessions', sessions
      ) order by sessions desc, source)
      from acquisition_mix
    ), '[]'::jsonb),
    'searchSurfaces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'surface', surface,
        'searches', searches,
        'averageQueryLength', average_query_length,
        'averageResults', average_results
      ) order by searches desc, surface)
      from search_surfaces
    ), '[]'::jsonb),
    'dataQuality', jsonb_build_object(
      'timezone', 'Asia/Ho_Chi_Minh',
      'seriesCappedAtDays', 180,
      'collectionStartedAt', (select min(created_at) from public.app_analytics_events),
      'consentModel', 'privacy-policy-covered public analytics',
      'privacyBoundaries', jsonb_build_array(
        'no raw IP address storage',
        'no search text storage',
        'no query-string storage',
        'staff profiles and internal routes excluded',
        'aggregate staff reporting only'
      )
    )
  )
  into v_payload;

  return coalesce(v_payload, '{}'::jsonb);
end;
$_$;


ALTER FUNCTION "public"."staff_product_analytics_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_progressive_pit"("p_taxable_income" bigint, "p_brackets" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  v_bracket jsonb;
  v_previous_cap numeric := 0;
  v_cap numeric;
  v_rate numeric;
  v_remaining numeric := greatest(0, coalesce(p_taxable_income, 0));
  v_tax numeric := 0;
begin
  if v_remaining <= 0 then return 0; end if;
  for v_bracket in select value from jsonb_array_elements(coalesce(p_brackets, '[]'::jsonb)) loop
    v_cap := nullif(v_bracket ->> 'up_to', '')::numeric;
    v_rate := greatest(0, coalesce((v_bracket ->> 'rate')::numeric, 0));
    if v_cap is null then
      v_tax := v_tax + v_remaining * v_rate / 100;
      v_remaining := 0;
    else
      v_tax := v_tax + least(v_remaining, greatest(0, v_cap - v_previous_cap)) * v_rate / 100;
      v_remaining := greatest(0, v_remaining - greatest(0, v_cap - v_previous_cap));
      v_previous_cap := v_cap;
    end if;
    exit when v_remaining <= 0;
  end loop;
  return round(v_tax)::bigint;
end;
$$;


ALTER FUNCTION "public"."staff_progressive_pit"("p_taxable_income" bigint, "p_brackets" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_remove_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  update public.session_participants
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = 'Removed from staff Sessions console',
      updated_at = now()
  where id = p_participant_id
    and session_id = p_session_id
    and deleted_at is null;

  if not found then
    raise exception 'Participant not found.';
  end if;

  return jsonb_build_object('participant_id', p_participant_id, 'removed', true);
end;
$$;


ALTER FUNCTION "public"."staff_remove_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_report_summary"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date" DEFAULT NULL::"date", "p_compare_end" "date" DEFAULT NULL::"date", "p_order_limit" integer DEFAULT 120) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.get_staff_daily_report(
    p_start_date,
    p_end_date,
    p_compare_start,
    p_compare_end,
    p_order_limit
  );
$$;


ALTER FUNCTION "public"."staff_report_summary"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select case
    when lower(coalesce(p_email, '')) = 'emilejacquet@icloud.com' then 120
    when lower(coalesce(p_email, '')) = 'emile@vre-vietnam.com' then 100
    when lower(coalesce(p_role, '')) in ('super_admin', 'owner') then 120
    when lower(coalesce(p_role, '')) = 'admin' then 100
    when lower(coalesce(p_role, '')) in ('cashier', 'viewer') then 20
    else 0
  end;
$$;


ALTER FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text") IS 'Ranks authenticated web-app roles only. Manager and Staff permissions are derived from employee PIN sessions.';



CREATE OR REPLACE FUNCTION "public"."staff_save_player_achievement_profile"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb" DEFAULT '[]'::"jsonb", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return public.staff_save_player_achievement_profile_v2(
    p_profile_id,
    p_loyalty_points,
    p_overall,
    p_games,
    p_achievement_changes,
    p_note,
    array[]::uuid[]
  );
end;
$$;


ALTER FUNCTION "public"."staff_save_player_achievement_profile"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_save_player_achievement_profile_v2"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb" DEFAULT '[]'::"jsonb", "p_note" "text" DEFAULT NULL::"text", "p_session_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_change jsonb;
  v_action text;
  v_id text;
  v_kind text;
  v_title text;
  v_description text;
  v_session_id uuid;
  v_before_stats jsonb;
  v_before_awards jsonb;
  v_before_sessions jsonb;
  v_after_stats jsonb;
  v_after_awards jsonb;
  v_after_sessions jsonb;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null or not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Staff note is too long.';
  end if;

  if p_achievement_changes is null or jsonb_typeof(p_achievement_changes) <> 'array' then
    raise exception 'Achievement changes must be an array.';
  end if;

  if jsonb_array_length(p_achievement_changes) > 100 then
    raise exception 'Too many achievement changes.';
  end if;

  if p_session_ids is null or cardinality(p_session_ids) > 50 then
    raise exception 'Choose up to 50 valid sessions.';
  end if;

  if exists (
    select 1
    from unnest(p_session_ids) as requested(requested_session_id)
    left join public.sessions requested_session
      on requested_session.id = requested.requested_session_id
      and requested_session.deleted_at is null
      and requested_session.status <> 'cancelled'
    where requested_session.id is null
  ) then
    raise exception 'One or more selected sessions are unavailable.';
  end if;

  v_before_stats := public.staff_get_player_stat_overrides(p_profile_id);

  select coalesce(jsonb_agg(to_jsonb(award) order by award.awarded_at), '[]'::jsonb)
  into v_before_awards
  from public.profile_achievement_awards award
  where award.profile_id = p_profile_id
    and award.revoked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sessions.id,
    'date', sessions.date,
    'startTime', sessions.start_time,
    'name', sessions.name
  ) order by sessions.date, sessions.start_time), '[]'::jsonb)
  into v_before_sessions
  from public.sessions
  where sessions.deleted_at is null
    and (
      sessions.owner_id = p_profile_id
      or exists (
        select 1
        from public.session_participants participant
        where participant.session_id = sessions.id
          and participant.profile_id = p_profile_id
          and participant.deleted_at is null
      )
    );

  v_after_stats := public.staff_set_player_stat_overrides(
    p_profile_id,
    p_loyalty_points,
    p_overall,
    p_games
  );

  for v_change in
    select value from jsonb_array_elements(p_achievement_changes)
  loop
    v_action := lower(nullif(btrim(v_change ->> 'action'), ''));
    v_id := nullif(btrim(v_change ->> 'id'), '');
    v_kind := lower(nullif(btrim(v_change ->> 'kind'), ''));
    v_title := nullif(btrim(v_change ->> 'title'), '');
    v_description := nullif(btrim(v_change ->> 'description'), '');

    if v_action not in ('unlock', 'remove')
      or v_kind not in ('game', 'retention')
      or v_id is null
      or char_length(v_id) > 120
    then
      raise exception 'Choose a valid achievement change.';
    end if;

    if v_action = 'unlock' then
      if v_title is null or char_length(v_title) > 160 then
        raise exception 'Achievement title is required.';
      end if;

      if v_description is not null and char_length(v_description) > 500 then
        raise exception 'Achievement description is too long.';
      end if;

      if not exists (
        select 1
        from public.profile_achievement_awards award
        where award.profile_id = p_profile_id
          and award.achievement_kind = v_kind
          and award.achievement_id = v_id
          and award.revoked_at is null
      ) then
        insert into public.profile_achievement_awards (
          profile_id,
          achievement_id,
          achievement_kind,
          title,
          description,
          note,
          awarded_by
        )
        values (
          p_profile_id,
          v_id,
          v_kind,
          v_title,
          v_description,
          v_note,
          v_actor
        );
      end if;
    else
      update public.profile_achievement_awards
      set revoked_by = v_actor,
          revoked_at = now(),
          note = coalesce(v_note, note),
          updated_at = now()
      where profile_id = p_profile_id
        and achievement_kind = v_kind
        and achievement_id = v_id
        and revoked_at is null;
    end if;
  end loop;

  for v_session_id in
    select distinct requested.requested_session_id
    from unnest(p_session_ids) as requested(requested_session_id)
  loop
    perform public.staff_upsert_session_participant_result_v2(
      p_session_id := v_session_id,
      p_profile_id := p_profile_id
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(award) order by award.awarded_at), '[]'::jsonb)
  into v_after_awards
  from public.profile_achievement_awards award
  where award.profile_id = p_profile_id
    and award.revoked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sessions.id,
    'date', sessions.date,
    'startTime', sessions.start_time,
    'name', sessions.name
  ) order by sessions.date, sessions.start_time), '[]'::jsonb)
  into v_after_sessions
  from public.sessions
  where sessions.deleted_at is null
    and (
      sessions.owner_id = p_profile_id
      or exists (
        select 1
        from public.session_participants participant
        where participant.session_id = sessions.id
          and participant.profile_id = p_profile_id
          and participant.deleted_at is null
      )
    );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_actor,
    'player_achievement_profile_updated',
    'profiles',
    p_profile_id,
    jsonb_build_object(
      'stats', v_before_stats,
      'manualAchievements', v_before_awards,
      'sessions', v_before_sessions
    ),
    jsonb_build_object(
      'note', v_note,
      'stats', v_after_stats,
      'manualAchievements', v_after_awards,
      'sessions', v_after_sessions
    )
  );

  return jsonb_build_object(
    'profileId', p_profile_id,
    'stats', v_after_stats,
    'manualAchievements', v_after_awards,
    'sessions', v_after_sessions
  );
end;
$$;


ALTER FUNCTION "public"."staff_save_player_achievement_profile_v2"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_save_player_achievement_profile_v3"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb" DEFAULT '[]'::"jsonb", "p_note" "text" DEFAULT NULL::"text", "p_session_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_result jsonb;
  v_session_id uuid;
  v_before_checked_in boolean;
begin
  v_result := public.staff_save_player_achievement_profile_v2(
    p_profile_id,
    p_loyalty_points,
    p_overall,
    p_games,
    p_achievement_changes,
    p_note,
    p_session_ids
  );

  for v_session_id in
    select distinct sessions.id
    from unnest(coalesce(p_session_ids, array[]::uuid[])) as requested(session_id)
    join public.sessions
      on sessions.id = requested.session_id
      and sessions.deleted_at is null
      and sessions.status <> 'cancelled'
    where sessions.date::timestamp + sessions.start_time
      <= timezone('Asia/Ho_Chi_Minh', now())
  loop
    select participant.checked_in
    into v_before_checked_in
    from public.session_participants participant
    where participant.session_id = v_session_id
      and participant.profile_id = p_profile_id
      and participant.deleted_at is null
    order by participant.joined_at desc, participant.id desc
    limit 1;

    perform public.staff_upsert_session_participant_result_v2(
      p_session_id := v_session_id,
      p_profile_id := p_profile_id,
      p_checked_in := true
    );

    if v_before_checked_in is distinct from true then
      insert into public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value
      )
      values (
        auth.uid(),
        'player_session_check_in_backfilled',
        'session_participants',
        v_session_id,
        jsonb_build_object(
          'checkedIn', coalesce(v_before_checked_in, false),
          'profileId', p_profile_id,
          'sessionId', v_session_id
        ),
        jsonb_build_object(
          'checkedIn', true,
          'profileId', p_profile_id,
          'sessionId', v_session_id
        )
      );
    end if;
  end loop;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."staff_save_player_achievement_profile_v3"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_hr_setup_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "option_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_hr_setup_options_name_check" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "staff_hr_setup_options_option_type_check" CHECK (("option_type" = ANY (ARRAY['department'::"text", 'job_title'::"text", 'location'::"text", 'contract_status'::"text", 'contract_type'::"text", 'employment_type'::"text", 'payroll_template'::"text", 'allowance'::"text", 'deduction'::"text"])))
);


ALTER TABLE "public"."staff_hr_setup_options" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_set_hr_setup_option_active"("p_option_id" "uuid", "p_active" boolean) RETURNS "public"."staff_hr_setup_options"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare v_result public.staff_hr_setup_options%rowtype;
begin
  if not private.is_staff_attendance_editor() then raise exception 'HR settings access required.'; end if;
  update public.staff_hr_setup_options
  set active = coalesce(p_active, false), updated_at = now()
  where id = p_option_id and deleted_at is null
  returning * into v_result;
  if v_result.id is null then raise exception 'HR option not found.'; end if;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."staff_set_hr_setup_option_active"("p_option_id" "uuid", "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := 'VR-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.staff_order_number_seq'::regclass)::text, 5, '0');
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_set_player_stat_overrides"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_entries jsonb;
  v_entry jsonb;
  v_scope text;
  v_sessions_joined integer;
  v_games_joined integer;
  v_wins integer;
  v_best_performer_count integer;
  v_total_score integer;
  v_best_score integer;
  v_average_accuracy double precision;
  v_total_projectiles integer;
  v_total_movement_meters double precision;
  v_best_escape_duration_seconds integer;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_loyalty_points is null or p_loyalty_points < 0 then
    raise exception 'Loyalty points must be zero or higher.';
  end if;

  if p_overall is null or jsonb_typeof(p_overall) <> 'object' then
    raise exception 'Overall stats must be an object.';
  end if;

  if p_games is null or jsonb_typeof(p_games) <> 'array' then
    raise exception 'Game stats must be an array.';
  end if;

  if jsonb_array_length(p_games) > 100 then
    raise exception 'Too many game stat rows.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Profile not found.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(existing) order by existing.scope), '[]'::jsonb)
  into v_before
  from public.player_stat_overrides existing
  where existing.profile_id = p_profile_id;

  v_entries := jsonb_build_array(p_overall || jsonb_build_object('scope', 'overall')) || p_games;

  for v_entry in
    select value
    from jsonb_array_elements(v_entries)
  loop
    v_scope := lower(nullif(btrim(v_entry ->> 'scope'), ''));

    if v_scope is null or char_length(v_scope) > 120 or v_scope !~ '^[a-z0-9][a-z0-9-]*$' then
      raise exception 'Choose a valid stat scope.';
    end if;

    if v_scope <> 'overall' and not exists (
      select 1
      from public.staff_games
      where slug = v_scope
    ) then
      raise exception 'Game not found: %', v_scope;
    end if;

    v_sessions_joined := nullif(v_entry ->> 'sessionsJoined', '')::integer;
    v_games_joined := nullif(v_entry ->> 'gamesJoined', '')::integer;
    v_wins := nullif(v_entry ->> 'wins', '')::integer;
    v_best_performer_count := nullif(v_entry ->> 'bestPerformerCount', '')::integer;
    v_total_score := nullif(v_entry ->> 'totalScore', '')::integer;
    v_best_score := nullif(v_entry ->> 'bestScore', '')::integer;
    v_average_accuracy := nullif(v_entry ->> 'averageAccuracy', '')::double precision;
    v_total_projectiles := nullif(v_entry ->> 'totalProjectiles', '')::integer;
    v_total_movement_meters := nullif(v_entry ->> 'totalMovementMeters', '')::double precision;
    v_best_escape_duration_seconds := nullif(v_entry ->> 'bestEscapeDurationSeconds', '')::integer;

    if coalesce(v_sessions_joined, 0) < 0
      or coalesce(v_games_joined, 0) < 0
      or coalesce(v_wins, 0) < 0
      or coalesce(v_best_performer_count, 0) < 0
      or coalesce(v_total_projectiles, 0) < 0
      or coalesce(v_total_movement_meters, 0) < 0
    then
      raise exception 'Counts and movement must be zero or higher.';
    end if;

    if v_average_accuracy is not null
      and (v_average_accuracy < 0 or v_average_accuracy > 100)
    then
      raise exception 'Accuracy must be between 0 and 100.';
    end if;

    if v_best_escape_duration_seconds is not null
      and v_best_escape_duration_seconds <= 0
    then
      raise exception 'Best escape time must be greater than zero.';
    end if;

    if v_games_joined is not null
      and v_wins is not null
      and v_wins > v_games_joined
    then
      raise exception 'Wins cannot be higher than games played.';
    end if;

    if v_scope = 'overall' then
      v_best_score := null;
    end if;

    if v_sessions_joined is null
      and v_games_joined is null
      and v_wins is null
      and v_best_performer_count is null
      and v_total_score is null
      and v_best_score is null
      and v_average_accuracy is null
      and v_total_projectiles is null
      and v_total_movement_meters is null
      and v_best_escape_duration_seconds is null
    then
      delete from public.player_stat_overrides
      where profile_id = p_profile_id
        and scope = v_scope;
    else
      insert into public.player_stat_overrides (
        profile_id,
        scope,
        sessions_joined,
        games_joined,
        wins,
        best_performer_count,
        total_score,
        best_score,
        average_accuracy,
        total_projectiles,
        total_movement_meters,
        best_escape_duration_seconds,
        updated_by
      )
      values (
        p_profile_id,
        v_scope,
        v_sessions_joined,
        v_games_joined,
        v_wins,
        v_best_performer_count,
        v_total_score,
        v_best_score,
        v_average_accuracy,
        v_total_projectiles,
        v_total_movement_meters,
        v_best_escape_duration_seconds,
        v_actor
      )
      on conflict (profile_id, scope)
      do update set
        sessions_joined = excluded.sessions_joined,
        games_joined = excluded.games_joined,
        wins = excluded.wins,
        best_performer_count = excluded.best_performer_count,
        total_score = excluded.total_score,
        best_score = excluded.best_score,
        average_accuracy = excluded.average_accuracy,
        total_projectiles = excluded.total_projectiles,
        total_movement_meters = excluded.total_movement_meters,
        best_escape_duration_seconds = excluded.best_escape_duration_seconds,
        updated_by = excluded.updated_by,
        updated_at = now();
    end if;
  end loop;

  update public.profiles
  set average_accuracy_override = nullif(p_overall ->> 'averageAccuracy', '')::double precision,
      total_projectiles_override = nullif(p_overall ->> 'totalProjectiles', '')::integer,
      best_escape_duration_seconds_override = nullif(
        p_overall ->> 'bestEscapeDurationSeconds',
        ''
      )::integer,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null;

  perform public.set_profile_loyalty_points(
    p_profile_id,
    p_loyalty_points,
    'Player stats editor'
  );

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value
    )
    values (
      v_actor,
      'player_stat_overrides_updated',
      'profiles',
      p_profile_id,
      jsonb_build_object('overrides', v_before),
      jsonb_build_object(
        'loyaltyPoints', p_loyalty_points,
        'overrides', (
          select coalesce(jsonb_agg(to_jsonb(saved) order by saved.scope), '[]'::jsonb)
          from public.player_stat_overrides saved
          where saved.profile_id = p_profile_id
        )
      )
    );
  end if;

  return public.staff_get_player_stat_overrides(p_profile_id);
end;
$_$;


ALTER FUNCTION "public"."staff_set_player_stat_overrides"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_sync_payroll_draft"("p_run_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Ho_Chi_Minh'::"text"))::"date", "p_force" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_settings public.staff_hr_settings%rowtype;
  v_period_start date;
  v_period_end date;
  v_run_code text;
  v_run_id uuid;
  v_existing_status text;
  v_item_count integer := 0;
begin
  if auth.uid() is not null and coalesce(public.current_staff_role_rank(), 0) < 100 then
    raise exception 'Only an owner or administrator can synchronize payroll.';
  end if;

  select * into v_settings
  from public.staff_hr_settings
  where id = 'default';

  if not found then
    raise exception 'HR salary settings are not configured.';
  end if;

  if not p_force
    and not v_settings.auto_create_payroll_runs
    and not v_settings.auto_update_payroll_daily
  then
    return jsonb_build_object('skipped', true, 'reason', 'automation_disabled');
  end if;

  if extract(day from p_run_date)::integer >= v_settings.pay_period_start_day then
    v_period_start := make_date(
      extract(year from p_run_date)::integer,
      extract(month from p_run_date)::integer,
      v_settings.pay_period_start_day
    );
  else
    v_period_start := (
      date_trunc('month', p_run_date)::date - interval '1 month'
      + (v_settings.pay_period_start_day - 1) * interval '1 day'
    )::date;
  end if;
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;
  v_run_code := 'AUTO-' || to_char(v_period_start, 'YYYYMMDD');

  select id, status into v_run_id, v_existing_status
  from public.staff_payroll_runs
  where code = v_run_code
    and deleted_at is null;

  if v_run_id is null and not (p_force or v_settings.auto_create_payroll_runs) then
    return jsonb_build_object('skipped', true, 'reason', 'auto_create_disabled');
  end if;
  if v_existing_status in ('approved', 'paid', 'cancelled') then
    return jsonb_build_object('skipped', true, 'reason', 'payroll_locked', 'payroll_run_id', v_run_id);
  end if;

  insert into public.staff_payroll_runs (
    code, name, pay_cycle, period_start, period_end, status, generated_by, notes
  ) values (
    v_run_code,
    'Automatic payroll ' || to_char(v_period_start, 'DD/MM/YYYY') || ' - ' || to_char(v_period_end, 'DD/MM/YYYY'),
    'monthly', v_period_start, v_period_end, 'draft', auth.uid(),
    'Automatically synchronized from HR attendance using the July 2026 payroll policy.'
  )
  on conflict (code) do update
  set
    name = excluded.name,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    updated_at = now()
  returning id into v_run_id;

  if p_force or v_settings.auto_update_payroll_daily or v_existing_status is null then
    with employee_rows as (
      select
        employee.profile_id,
        employee.employee_code,
        employee.legal_name,
        employee.employment_type,
        employee.contract_status,
        coalesce(employee.base_salary_vnd, 0) as base_salary_vnd,
        coalesce(employee.hourly_rate_vnd, 0) as configured_hourly_rate_vnd,
        coalesce(nullif(employee.lunch_allowance_vnd, 0), v_settings.lunch_allowance_vnd, 0) as lunch_allowance_vnd,
        coalesce(employee.overtime_rate_multiplier, v_settings.normal_overtime_multiplier, 0) as overtime_rate,
        coalesce(employee.night_rate_multiplier, v_settings.night_overtime_multiplier, 0) as night_rate,
        coalesce(employee.holiday_rate_multiplier, v_settings.holiday_overtime_multiplier, 0) as holiday_rate,
        coalesce(employee.employee_contribution_rate, v_settings.employee_contribution_rate, 0) as employee_contribution_rate,
        coalesce(employee.employer_contribution_rate, v_settings.employer_contribution_rate, 0) as employer_contribution_rate,
        coalesce(employee.pit_withholding_rate, v_settings.pit_withholding_rate, 0) as pit_rate
      from public.staff_employee_profiles as employee
      where employee.active = true
        and employee.contract_status in ('active', 'probation')
        and employee.deleted_at is null
    ),
    schedule_rows as (
      select
        shift.staff_profile_id as profile_id,
        coalesce(sum(greatest(
          0,
          floor(extract(epoch from (
            (shift.shift_date + shift.end_time)::timestamp
            + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
            - (shift.shift_date + shift.start_time)::timestamp
          )) / 60)::integer - coalesce(shift.break_minutes, 0)
        )), 0)::integer as scheduled_minutes
      from public.staff_schedule_shifts as shift
      where shift.shift_date between v_period_start and v_period_end
        and shift.status in ('draft', 'published', 'completed')
        and shift.deleted_at is null
      group by shift.staff_profile_id
    ),
    attendance_rows as (
      select
        log.staff_profile_id as profile_id,
        coalesce(sum(greatest(
          0,
          floor(extract(epoch from (log.clock_out_at - log.clock_in_at)) / 60)::integer
            - coalesce(log.break_minutes, 0)
        )) filter (where log.clock_in_at is not null and log.clock_out_at is not null), 0)::integer as worked_minutes,
        coalesce(sum(log.regular_minutes), 0)::integer as regular_minutes,
        coalesce(sum(log.overtime_minutes), 0)::integer as overtime_minutes,
        coalesce(sum(log.night_minutes), 0)::integer as night_minutes,
        coalesce(sum(log.holiday_minutes), 0)::integer as holiday_minutes,
        count(distinct log.work_date) filter (where log.clock_in_at is not null and log.clock_out_at is not null)::integer as worked_days
      from public.staff_attendance_logs as log
      where log.work_date between v_period_start and v_period_end
        and log.deleted_at is null
      group by log.staff_profile_id
    ),
    leave_rows as (
      select
        leave_request.staff_profile_id as profile_id,
        coalesce(sum(
          leave_request.hours
          * ((least(leave_request.end_date, v_period_end) - greatest(leave_request.start_date, v_period_start) + 1)::numeric
            / greatest(1, leave_request.end_date - leave_request.start_date + 1))
        ), 0)::numeric(7, 2) as paid_leave_hours
      from public.staff_leave_requests as leave_request
      join employee_rows as employee on employee.profile_id = leave_request.staff_profile_id
      where leave_request.status = 'approved'
        and leave_request.leave_type in ('annual', 'public_holiday')
        and employee.employment_type in ('full_time', 'probation_full_time')
        and leave_request.end_date >= v_period_start
        and leave_request.start_date <= v_period_end
        and leave_request.deleted_at is null
      group by leave_request.staff_profile_id
    ),
    adjustment_rows as (
      select
        adjustment.profile_id,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type in ('allowance', 'lunch_allowance')), 0)::integer as allowances,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type in ('bonus', 'commission')), 0)::integer as bonuses,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type in ('advance', 'debt', 'debt_repayment')), 0)::integer as advances,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type = 'deduction'), 0)::integer as deductions
      from public.staff_hr_adjustments as adjustment
      where adjustment.status in ('approved', 'paid')
        and adjustment.deleted_at is null
        and (
          (adjustment.period_start is not null and adjustment.period_end is not null
            and adjustment.period_start <= v_period_end and adjustment.period_end >= v_period_start)
          or
          ((adjustment.period_start is null or adjustment.period_end is null)
            and adjustment.effective_date between v_period_start and v_period_end)
        )
      group by adjustment.profile_id
    ),
    base_rows as (
      select
        employee.*,
        coalesce(schedule.scheduled_minutes, 0) as scheduled_minutes,
        greatest(round(v_settings.standard_monthly_hours * 60)::integer, coalesce(schedule.scheduled_minutes, 0), 1) as period_standard_minutes,
        coalesce(attendance.worked_minutes, 0) as worked_minutes,
        coalesce(attendance.regular_minutes, 0) as logged_regular_minutes,
        case
          when coalesce(attendance.overtime_minutes, 0) > 0 then attendance.overtime_minutes
          when coalesce(schedule.scheduled_minutes, 0) > 0 then greatest(
            0,
            coalesce(attendance.worked_minutes, 0)
              - coalesce(nullif(attendance.regular_minutes, 0), least(coalesce(attendance.worked_minutes, 0), schedule.scheduled_minutes))
          )
          else 0
        end::integer as overtime_minutes,
        coalesce(attendance.night_minutes, 0) as night_minutes,
        coalesce(attendance.holiday_minutes, 0) as holiday_minutes,
        coalesce(attendance.worked_days, 0) as worked_days,
        coalesce(leave_data.paid_leave_hours, 0) as paid_leave_hours,
        coalesce(adjustment.allowances, 0) + employee.lunch_allowance_vnd * coalesce(attendance.worked_days, 0) as allowances,
        coalesce(adjustment.bonuses, 0) as bonuses,
        coalesce(adjustment.advances, 0) as advances,
        coalesce(adjustment.deductions, 0) as deductions
      from employee_rows as employee
      left join schedule_rows as schedule on schedule.profile_id = employee.profile_id
      left join attendance_rows as attendance on attendance.profile_id = employee.profile_id
      left join leave_rows as leave_data on leave_data.profile_id = employee.profile_id
      left join adjustment_rows as adjustment on adjustment.profile_id = employee.profile_id
    ),
    rate_rows as (
      select
        base.*,
        case
          when base.configured_hourly_rate_vnd > 0 then base.configured_hourly_rate_vnd
          when base.base_salary_vnd > 0 then base.base_salary_vnd / greatest(1, base.period_standard_minutes / 60.0)
          else 0
        end as payroll_hourly_rate_vnd,
        case
          when base.logged_regular_minutes > 0 then base.logged_regular_minutes
          else greatest(0, base.worked_minutes - base.overtime_minutes)
        end::integer as base_worked_minutes
      from base_rows as base
    ),
    pay_rows as (
      select
        rate.*,
        (rate.base_worked_minutes + round(rate.paid_leave_hours * 60)::integer) as salary_paid_minutes,
        case
          when rate.employment_type in ('full_time', 'probation_full_time') and rate.base_salary_vnd > 0
            then round(rate.base_salary_vnd * least(
              1,
              (rate.base_worked_minutes + rate.paid_leave_hours * 60) / greatest(1, rate.period_standard_minutes)::numeric
            ))::integer
          else round((rate.base_worked_minutes / 60.0) * rate.payroll_hourly_rate_vnd)::integer
        end as base_pay,
        round(
          (rate.overtime_minutes / 60.0) * rate.payroll_hourly_rate_vnd * rate.overtime_rate
          + (rate.night_minutes / 60.0) * rate.payroll_hourly_rate_vnd * greatest(0, rate.night_rate - 1)
          + (rate.holiday_minutes / 60.0) * rate.payroll_hourly_rate_vnd * greatest(0, rate.holiday_rate - 1)
        )::integer as overtime_pay,
        case
          when rate.employment_type = 'full_time' and rate.contract_status = 'active'
            then rate.base_salary_vnd
          else 0
        end::integer as contribution_base
      from rate_rows as rate
    ),
    gross_rows as (
      select
        pay.*,
        greatest(0, pay.base_pay + pay.overtime_pay + pay.allowances + pay.bonuses)::integer as gross_income
      from pay_rows as pay
    ),
    contribution_rows as (
      select
        gross.*,
        case when v_settings.social_insurance_enabled
          then round(gross.contribution_base * gross.employee_contribution_rate / 100.0)::integer else 0 end as employee_contributions,
        case when v_settings.social_insurance_enabled
          then round(gross.contribution_base * gross.employer_contribution_rate / 100.0)::integer else 0 end as employer_contributions
      from gross_rows as gross
    ),
    final_rows as (
      select
        contribution.*,
        case when v_settings.personal_income_tax_enabled
          then round(
            greatest(0, contribution.gross_income - contribution.employee_contributions - contribution.deductions - contribution.advances)
            * contribution.pit_rate / 100.0
          )::integer else 0 end as pit_withheld
      from contribution_rows as contribution
    )
    insert into public.staff_payroll_items (
      payroll_run_id, profile_id, payslip_number, worked_minutes, regular_minutes, overtime_minutes,
      night_minutes, holiday_minutes, paid_leave_hours, base_salary_vnd, overtime_pay_vnd, allowances_vnd,
      bonuses_vnd, advances_vnd, deductions_vnd, employee_contributions_vnd, employer_contributions_vnd,
      pit_withholding_vnd, gross_income_vnd, net_income_vnd, company_cost_vnd, status, payslip_snapshot,
      deleted_at, deleted_by, delete_reason
    )
    select
      v_run_id,
      final.profile_id,
      v_run_code || '-' || coalesce(final.employee_code, left(final.profile_id::text, 6)),
      final.worked_minutes,
      final.base_worked_minutes,
      final.overtime_minutes,
      final.night_minutes,
      final.holiday_minutes,
      final.paid_leave_hours,
      final.base_pay,
      final.overtime_pay,
      final.allowances,
      final.bonuses,
      final.advances,
      final.deductions,
      final.employee_contributions,
      final.employer_contributions,
      final.pit_withheld,
      final.gross_income,
      greatest(0, final.gross_income - final.employee_contributions - final.pit_withheld - final.deductions - final.advances),
      greatest(0, final.gross_income + final.employer_contributions),
      'draft',
      jsonb_build_object(
        'employeeCode', final.employee_code,
        'employeeName', final.legal_name,
        'periodStart', v_period_start,
        'periodEnd', v_period_end,
        'currency', v_settings.currency,
        'automated', true,
        'workedDays', final.worked_days,
        'periodStandardMinutes', final.period_standard_minutes,
        'salaryPaidMinutes', final.salary_paid_minutes,
        'payrollHourlyRateVnd', final.payroll_hourly_rate_vnd,
        'contributionBaseVnd', final.contribution_base,
        'policyReference', 'VR_Payroll_July_2026_QA'
      ),
      null, null, null
    from final_rows as final
    on conflict (payroll_run_id, profile_id) do update
    set
      payslip_number = excluded.payslip_number,
      worked_minutes = excluded.worked_minutes,
      regular_minutes = excluded.regular_minutes,
      overtime_minutes = excluded.overtime_minutes,
      night_minutes = excluded.night_minutes,
      holiday_minutes = excluded.holiday_minutes,
      paid_leave_hours = excluded.paid_leave_hours,
      base_salary_vnd = excluded.base_salary_vnd,
      overtime_pay_vnd = excluded.overtime_pay_vnd,
      allowances_vnd = excluded.allowances_vnd,
      bonuses_vnd = excluded.bonuses_vnd,
      advances_vnd = excluded.advances_vnd,
      deductions_vnd = excluded.deductions_vnd,
      employee_contributions_vnd = excluded.employee_contributions_vnd,
      employer_contributions_vnd = excluded.employer_contributions_vnd,
      pit_withholding_vnd = excluded.pit_withholding_vnd,
      gross_income_vnd = excluded.gross_income_vnd,
      net_income_vnd = excluded.net_income_vnd,
      company_cost_vnd = excluded.company_cost_vnd,
      payslip_snapshot = excluded.payslip_snapshot,
      deleted_at = null,
      deleted_by = null,
      delete_reason = null,
      updated_at = now();

    get diagnostics v_item_count = row_count;

    update public.staff_payroll_items as item
    set deleted_at = now(), delete_reason = 'No longer active during automatic payroll synchronization.'
    where item.payroll_run_id = v_run_id
      and item.deleted_at is null
      and not exists (
        select 1 from public.staff_employee_profiles as employee
        where employee.profile_id = item.profile_id
          and employee.active = true
          and employee.contract_status in ('active', 'probation')
          and employee.deleted_at is null
      );

    update public.staff_payroll_runs as run
    set
      total_gross_vnd = totals.total_gross,
      total_net_vnd = totals.total_net,
      total_company_cost_vnd = totals.total_company_cost,
      updated_at = now()
    from (
      select
        coalesce(sum(item.gross_income_vnd), 0)::integer as total_gross,
        coalesce(sum(item.net_income_vnd), 0)::integer as total_net,
        coalesce(sum(item.company_cost_vnd), 0)::integer as total_company_cost
      from public.staff_payroll_items as item
      where item.payroll_run_id = v_run_id and item.deleted_at is null
    ) as totals
    where run.id = v_run_id;

    update public.staff_hr_settings
    set last_auto_payroll_sync_on = p_run_date
    where id = 'default';
  end if;

  return jsonb_build_object(
    'skipped', false,
    'payroll_run_id', v_run_id,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'item_count', v_item_count
  );
end;
$$;


ALTER FUNCTION "public"."staff_sync_payroll_draft"("p_run_date" "date", "p_force" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."staff_sync_payroll_draft"("p_run_date" "date", "p_force" boolean) IS 'Builds draft payroll using paid annual leave, per-worked-day meal allowance, and non-duplicated overtime rules aligned to VR_Payroll_July_2026_QA.';



CREATE OR REPLACE FUNCTION "public"."staff_ticket_price_rule_id"("p_game_id" "text" DEFAULT NULL::"text", "p_booking_date" "date" DEFAULT NULL::"date", "p_booking_time" time without time zone DEFAULT NULL::time without time zone) RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select r.id
  from public.staff_pricing_rules r
  where r.active = true
    and r.valid_from <= coalesce(p_booking_date, current_date)
    and (r.valid_until is null or r.valid_until >= coalesce(p_booking_date, current_date))
    and public.staff_discount_rule_matches_game(r.game_id, p_game_id)
    and (
      r.day_type = 'custom'
      or (r.day_type = 'holiday' and coalesce(p_booking_date, current_date) between r.valid_from and coalesce(r.valid_until, r.valid_from))
      or (r.day_type = 'weekend' and extract(isodow from coalesce(p_booking_date, current_date)) in (6, 7))
      or (r.day_type = 'weekday' and extract(isodow from coalesce(p_booking_date, current_date)) between 1 and 5)
    )
    and (
      (p_booking_time is null and r.time_start is null and r.time_end is null)
      or (
        p_booking_time is not null
        and (r.time_start is null or p_booking_time >= r.time_start)
        and (r.time_end is null or p_booking_time < r.time_end)
      )
    )
  order by
    case when r.game_id is not null then 0 else 1 end,
    case when r.day_type in ('custom', 'holiday') then 0 else 1 end,
    r.valid_from desc,
    r.created_at desc
  limit 1;
$$;


ALTER FUNCTION "public"."staff_ticket_price_rule_id"("p_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_update_hr_setup_option"("p_option_id" "uuid", "p_name" "text") RETURNS "public"."staff_hr_setup_options"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  v_option public.staff_hr_setup_options%rowtype;
  v_result public.staff_hr_setup_options%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old_token text;
  v_new_token text;
begin
  if not private.is_staff_attendance_editor() then
    raise exception 'HR settings access required.';
  end if;
  if length(v_name) = 0 then
    raise exception 'Option name is required.';
  end if;

  select * into v_option
  from public.staff_hr_setup_options
  where id = p_option_id and deleted_at is null
  for update;

  if v_option.id is null then
    raise exception 'HR option not found.';
  end if;

  v_old_token := lower(regexp_replace(trim(v_option.name), '[[:space:]-]+', '_', 'g'));
  v_new_token := lower(regexp_replace(v_name, '[[:space:]-]+', '_', 'g'));

  if v_option.option_type = 'contract_status'
    and v_new_token not in ('active', 'probation', 'suspended', 'ended', 'draft')
  then
    raise exception 'Contract status must be Active, Probation, Suspended, Ended, or Draft.';
  end if;
  if v_option.option_type = 'employment_type'
    and v_new_token not in ('full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern')
  then
    raise exception 'Employment type is not supported by payroll.';
  end if;

  case v_option.option_type
    when 'department' then
      update public.staff_employee_profiles set department = v_name
      where department = v_option.name and deleted_at is null;
    when 'job_title' then
      update public.staff_employee_profiles set job_title = v_name
      where job_title = v_option.name and deleted_at is null;
      update public.staff_schedule_shifts set shift_role = v_name
      where shift_role = v_option.name and deleted_at is null;
    when 'location' then
      update public.staff_employee_profiles
      set main_work_location = case when main_work_location = v_option.name then v_name else main_work_location end,
          payroll_location = case when payroll_location = v_option.name then v_name else payroll_location end
      where (main_work_location = v_option.name or payroll_location = v_option.name)
        and deleted_at is null;
      update public.staff_schedule_shifts set location = v_name
      where location = v_option.name and deleted_at is null;
      update public.staff_attendance_settings set location = v_name
      where location = v_option.name;
    when 'contract_status' then
      update public.staff_employee_profiles set contract_status = v_new_token
      where contract_status = v_old_token and deleted_at is null;
    when 'contract_type' then
      update public.staff_employee_profiles set contract_type = v_name
      where contract_type = v_option.name and deleted_at is null;
    when 'employment_type' then
      update public.staff_employee_profiles set employment_type = v_new_token
      where employment_type = v_old_token and deleted_at is null;
    else
      null;
  end case;

  update public.staff_hr_setup_options
  set name = v_name, active = true, updated_at = now()
  where id = p_option_id
  returning * into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."staff_update_hr_setup_option"("p_option_id" "uuid", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_update_order_operation"("p_order_id" "uuid", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_total" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_order public.staff_orders%rowtype;
  v_updated_order public.staff_orders%rowtype;
  v_game public.staff_games%rowtype;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_order_id is null then
    raise exception 'Order id is required.';
  end if;

  if p_game_id is null then
    raise exception 'Game is required.';
  end if;

  if p_booking_date is null or p_booking_time is null then
    raise exception 'Booking date and time are required.';
  end if;

  if p_total is null or p_total < 0 then
    raise exception 'Total must be zero or higher.';
  end if;

  select *
  into v_order
  from public.staff_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if p_total > 2147483647 - v_order.discount_total then
    raise exception 'Total is too large.';
  end if;

  select *
  into v_game
  from public.staff_games
  where id = p_game_id;

  if not found then
    raise exception 'Game not found.';
  end if;

  update public.staff_orders
  set game_id = v_game.id,
      booking_date = p_booking_date,
      booking_time = p_booking_time,
      subtotal = p_total + discount_total,
      total = p_total,
      updated_at = now()
  where id = p_order_id
  returning * into v_updated_order;

  if v_order.session_id is not null then
    update public.sessions
    set date = p_booking_date,
        start_time = p_booking_time,
        confirmed_game_id = v_game.slug,
        ticket_total_price = case
          when booking_type = 'ticket' then p_total
          else ticket_total_price
        end,
        updated_at = now()
    where id = v_order.session_id
      and deleted_at is null;
  end if;

  return to_jsonb(v_updated_order);
end;
$$;


ALTER FUNCTION "public"."staff_update_order_operation"("p_order_id" "uuid", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_total" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_update_session_operation"("p_session_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_date" "date" DEFAULT NULL::"date", "p_start_time" time without time zone DEFAULT NULL::time without time zone, "p_duration_minutes" integer DEFAULT NULL::integer, "p_max_players" integer DEFAULT NULL::integer, "p_arena_count" integer DEFAULT NULL::integer, "p_visibility" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_confirmed_game_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_session public.sessions%rowtype;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Session not found.';
  end if;

  update public.sessions
  set name = coalesce(nullif(btrim(p_name), ''), name),
      date = coalesce(p_date, date),
      start_time = coalesce(p_start_time, start_time),
      duration_minutes = case when p_duration_minutes is null then duration_minutes else greatest(20, least(240, p_duration_minutes)) end,
      max_players = case when p_max_players is null then max_players else greatest(1, least(80, p_max_players)) end,
      arena_count = case when p_arena_count is null then arena_count else greatest(1, least(8, p_arena_count)) end,
      visibility = case when p_visibility in ('public', 'private') then p_visibility else visibility end,
      status = case when p_status in ('open', 'cancelled', 'completed') then p_status else status end,
      confirmed_game_id = case when p_confirmed_game_id is null then confirmed_game_id else nullif(p_confirmed_game_id, '') end,
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('session_id', p_session_id);
end;
$$;


ALTER FUNCTION "public"."staff_update_session_operation"("p_session_id" "uuid", "p_name" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_max_players" integer, "p_arena_count" integer, "p_visibility" "text", "p_status" "text", "p_confirmed_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_upsert_hr_setup_option"("p_option_type" "text", "p_name" "text") RETURNS "public"."staff_hr_setup_options"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare v_result public.staff_hr_setup_options%rowtype;
begin
  if not private.is_staff_attendance_editor() then raise exception 'HR settings access required.'; end if;
  if p_option_type not in ('department','job_title','location','contract_status','contract_type','employment_type','payroll_template','allowance','deduction') then
    raise exception 'Unsupported HR option type.';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Option name is required.'; end if;
  insert into public.staff_hr_setup_options(option_type, name, active, sort_order, created_by)
  values (p_option_type, trim(p_name), true,
    coalesce((select max(sort_order) + 10 from public.staff_hr_setup_options where option_type = p_option_type and deleted_at is null), 10),
    (select auth.uid()))
  on conflict (option_type, lower(name)) where deleted_at is null
  do update set active = true, name = excluded.name, updated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."staff_upsert_hr_setup_option"("p_option_type" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_upsert_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid" DEFAULT NULL::"uuid", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_display_name" "text" DEFAULT NULL::"text", "p_checked_in" boolean DEFAULT NULL::boolean, "p_payment_status" "text" DEFAULT NULL::"text", "p_payment_amount" integer DEFAULT NULL::integer, "p_score" integer DEFAULT NULL::integer, "p_accuracy_percent" double precision DEFAULT NULL::double precision, "p_projectiles_fired" integer DEFAULT NULL::integer, "p_escape_duration_seconds" integer DEFAULT NULL::integer, "p_placement" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_session public.sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_participant public.session_participants%rowtype;
  v_display_name text;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  if p_accuracy_percent is not null and (p_accuracy_percent < 0 or p_accuracy_percent > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_projectiles_fired is not null and p_projectiles_fired < 0 then
    raise exception 'Shots must be zero or higher.';
  end if;

  if p_escape_duration_seconds is not null and p_escape_duration_seconds <= 0 then
    raise exception 'Escape time must be greater than 0.';
  end if;

  if p_placement is not null and p_placement < 1 then
    raise exception 'Placement must be positive.';
  end if;

  if p_participant_id is not null then
    update public.session_participants
    set checked_in = coalesce(p_checked_in, checked_in),
        payment_status = case when p_payment_status is null then payment_status else nullif(p_payment_status, '') end,
        payment_amount = p_payment_amount,
        checked_in_at = case
          when p_checked_in is true and checked_in_at is null then now()
          when p_checked_in is false then null
          else checked_in_at
        end,
        score = p_score,
        accuracy_percent = p_accuracy_percent,
        projectiles_fired = p_projectiles_fired,
        escape_duration_seconds = p_escape_duration_seconds,
        placement = p_placement,
        updated_at = now()
    where id = p_participant_id
      and session_id = p_session_id
      and deleted_at is null
    returning * into v_participant;

    if not found then
      raise exception 'Participant not found.';
    end if;
  else
    if p_profile_id is null then
      raise exception 'Profile id is required.';
    end if;

    select *
    into v_profile
    from public.profiles
    where id = p_profile_id
      and deleted_at is null;

    if not found then
      raise exception 'Profile not found.';
    end if;

    v_display_name := coalesce(nullif(btrim(p_display_name), ''), v_profile.nickname, v_profile.full_name, v_profile.phone, v_profile.email, 'Player');

    select *
    into v_participant
    from public.session_participants
    where session_id = p_session_id
      and profile_id = p_profile_id
    order by deleted_at nulls first, created_at desc
    limit 1
    for update;

    if found then
      update public.session_participants
      set deleted_at = null,
          deleted_by = null,
          delete_reason = null,
          display_name = v_display_name,
          avatar_url = v_profile.avatar_url,
          avatar_emoji = v_profile.avatar_emoji,
          avatar_initials = v_profile.avatar_initials,
          avatar_color = v_profile.avatar_color,
          avatar_text_color = v_profile.avatar_text_color,
          profile_motto = v_profile.profile_motto,
          updated_at = now()
      where id = v_participant.id
      returning * into v_participant;
    else
      insert into public.session_participants (
        session_id,
        profile_id,
        display_name,
        avatar_url,
        avatar_emoji,
        avatar_initials,
        avatar_color,
        avatar_text_color,
        profile_motto,
        checked_in,
        payment_status,
        payment_amount,
        checked_in_at
      )
      values (
        p_session_id,
        p_profile_id,
        v_display_name,
        v_profile.avatar_url,
        v_profile.avatar_emoji,
        v_profile.avatar_initials,
        v_profile.avatar_color,
        v_profile.avatar_text_color,
        v_profile.profile_motto,
        coalesce(p_checked_in, false),
        nullif(p_payment_status, ''),
        p_payment_amount,
        case when coalesce(p_checked_in, false) then now() else null end
      )
      returning * into v_participant;
    end if;
  end if;

  return jsonb_build_object('participant_id', v_participant.id, 'session_id', v_participant.session_id);
end;
$$;


ALTER FUNCTION "public"."staff_upsert_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_projectiles_fired" integer, "p_escape_duration_seconds" integer, "p_placement" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_upsert_session_participant_result_v2"("p_session_id" "uuid", "p_participant_id" "uuid" DEFAULT NULL::"uuid", "p_profile_id" "uuid" DEFAULT NULL::"uuid", "p_display_name" "text" DEFAULT NULL::"text", "p_checked_in" boolean DEFAULT NULL::boolean, "p_payment_status" "text" DEFAULT NULL::"text", "p_payment_amount" integer DEFAULT NULL::integer, "p_score" integer DEFAULT NULL::integer, "p_accuracy_percent" double precision DEFAULT NULL::double precision, "p_hits" integer DEFAULT NULL::integer, "p_movement_meters" numeric DEFAULT NULL::numeric, "p_escape_duration_seconds" integer DEFAULT NULL::integer, "p_placement" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_session public.sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_participant public.session_participants%rowtype;
  v_display_name text;
  v_checked_in boolean;
  v_avatar_url text;
  v_avatar_emoji text;
  v_avatar_initials text;
  v_avatar_color text;
  v_avatar_text_color text;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  if p_accuracy_percent is not null and (p_accuracy_percent < 0 or p_accuracy_percent > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_hits is not null and p_hits < 0 then
    raise exception 'Hits must be zero or higher.';
  end if;

  if p_movement_meters is not null and p_movement_meters < 0 then
    raise exception 'Movement must be zero or higher.';
  end if;

  if p_escape_duration_seconds is not null and p_escape_duration_seconds <= 0 then
    raise exception 'Escape time must be greater than 0.';
  end if;

  if p_placement is not null and p_placement < 1 then
    raise exception 'Placement must be positive.';
  end if;

  if p_participant_id is not null then
    update public.session_participants
    set checked_in = coalesce(p_checked_in, checked_in),
        payment_status = case when p_payment_status is null then payment_status else nullif(p_payment_status, '') end,
        payment_amount = p_payment_amount,
        checked_in_at = case
          when p_checked_in is true and checked_in_at is null then now()
          when p_checked_in is false then null
          else checked_in_at
        end,
        score = p_score,
        accuracy_percent = p_accuracy_percent,
        hits = p_hits,
        movement_meters = p_movement_meters,
        escape_duration_seconds = p_escape_duration_seconds,
        placement = p_placement,
        updated_at = now()
    where id = p_participant_id
      and session_id = p_session_id
      and deleted_at is null
    returning * into v_participant;

    if not found then
      raise exception 'Participant not found.';
    end if;
  else
    if p_profile_id is null then
      raise exception 'Profile id is required.';
    end if;

    select *
    into v_profile
    from public.profiles
    where id = p_profile_id
      and deleted_at is null;

    if not found then
      raise exception 'Profile not found.';
    end if;

    v_display_name := case
      when coalesce(v_profile.anonymous_mode, false) then
        public.profile_public_display_name(
          v_profile.id,
          v_profile.nickname,
          v_profile.full_name,
          v_profile.phone,
          v_profile.anonymous_mode,
          v_profile.anonymous_callsign
        )
      else coalesce(
        nullif(btrim(p_display_name), ''),
        public.profile_public_display_name(
          v_profile.id,
          v_profile.nickname,
          v_profile.full_name,
          v_profile.phone,
          v_profile.anonymous_mode,
          v_profile.anonymous_callsign
        ),
        v_profile.email,
        'Player'
      )
    end;

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

    v_checked_in := case
      when p_checked_in is not null then p_checked_in
      when v_session.status <> 'cancelled'
        and v_session.date::timestamp + v_session.start_time
          <= timezone('Asia/Ho_Chi_Minh', now())
      then true
      else null
    end;

    select *
    into v_participant
    from public.session_participants
    where session_id = p_session_id
      and profile_id = p_profile_id
    order by deleted_at nulls first, joined_at desc, id desc
    limit 1
    for update;

    if found then
      update public.session_participants
      set deleted_at = null,
          deleted_by = null,
          delete_reason = null,
          display_name = v_display_name,
          avatar_url = v_avatar_url,
          avatar_emoji = v_avatar_emoji,
          avatar_initials = v_avatar_initials,
          avatar_color = v_avatar_color,
          avatar_text_color = v_avatar_text_color,
          profile_motto = v_profile.profile_motto,
          checked_in = coalesce(v_checked_in, checked_in),
          checked_in_at = case
            when v_checked_in is true and checked_in_at is null then now()
            when v_checked_in is false then null
            else checked_in_at
          end,
          updated_at = now()
      where id = v_participant.id
      returning * into v_participant;
    else
      insert into public.session_participants (
        session_id,
        profile_id,
        display_name,
        avatar_url,
        avatar_emoji,
        avatar_initials,
        avatar_color,
        avatar_text_color,
        profile_motto,
        checked_in,
        payment_status,
        payment_amount,
        checked_in_at
      )
      values (
        p_session_id,
        p_profile_id,
        v_display_name,
        v_avatar_url,
        v_avatar_emoji,
        v_avatar_initials,
        v_avatar_color,
        v_avatar_text_color,
        v_profile.profile_motto,
        coalesce(v_checked_in, false),
        nullif(p_payment_status, ''),
        p_payment_amount,
        case when coalesce(v_checked_in, false) then now() else null end
      )
      returning * into v_participant;
    end if;
  end if;

  return jsonb_build_object('participant_id', v_participant.id, 'session_id', v_participant.session_id);
end;
$$;


ALTER FUNCTION "public"."staff_upsert_session_participant_result_v2"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_hits" integer, "p_movement_meters" numeric, "p_escape_duration_seconds" integer, "p_placement" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_now" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_identity public.staff_zalo_identities%rowtype;
  v_employee public.staff_employee_profiles%rowtype;
  v_shift public.staff_schedule_shifts%rowtype;
  v_log public.staff_attendance_logs%rowtype;
  v_work_date date := (p_now at time zone 'Asia/Ho_Chi_Minh')::date;
  v_local_time time := (p_now at time zone 'Asia/Ho_Chi_Minh')::time;
  v_standard_daily_minutes integer := 480;
  v_night_start time := '22:00';
  v_night_end time := '06:00';
  v_scheduled_minutes integer := 480;
  v_worked_minutes integer := 0;
  v_regular_minutes integer := 0;
  v_overtime_minutes integer := 0;
  v_night_minutes integer := 0;
  v_status text := 'present';
begin
  if p_action not in ('clock_in', 'clock_out') then
    raise exception 'Unsupported attendance action.';
  end if;

  if p_identity_id is null then
    raise exception 'A linked Zalo identity is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_identity_id::text, 0));

  select *
  into v_identity
  from public.staff_zalo_identities
  where id = p_identity_id
    and revoked_at is null;

  if not found then
    raise exception 'The Zalo account is not linked to an employee.';
  end if;

  select *
  into v_employee
  from public.staff_employee_profiles
  where profile_id = v_identity.staff_profile_id
    and active = true
    and coalesce(contract_status, 'active') in ('active', 'probation')
    and deleted_at is null;

  if not found then
    raise exception 'The employee profile is not active.';
  end if;

  perform public.consume_rate_limit(
    'staff_config_write',
    12,
    60,
    'zalo-attendance:' || p_action || ':' || p_identity_id::text
  );

  select
    coalesce(standard_daily_minutes, 480),
    coalesce(night_start, '22:00'::time),
    coalesce(night_end, '06:00'::time)
  into v_standard_daily_minutes, v_night_start, v_night_end
  from public.staff_attendance_settings
  where id = 'default';

  select *
  into v_shift
  from public.staff_schedule_shifts
  where staff_profile_id = v_identity.staff_profile_id
    and shift_date = v_work_date
    and status in ('published', 'completed')
    and deleted_at is null
  order by start_time asc
  limit 1;

  if p_action = 'clock_in' then
    select *
    into v_log
    from public.staff_attendance_logs
    where staff_profile_id = v_identity.staff_profile_id
      and clock_in_at is not null
      and clock_out_at is null
      and deleted_at is null
      and status not in ('absent', 'no_show', 'leave', 'holiday')
    order by clock_in_at desc
    limit 1
    for update;

    if found then
      return jsonb_build_object(
        'idempotent', true,
        'action', 'clock_in',
        'employee_profile_id', v_identity.staff_profile_id,
        'attendance_log', jsonb_build_object(
          'id', v_log.id,
          'work_date', v_log.work_date,
          'clock_in_at', v_log.clock_in_at,
          'clock_out_at', v_log.clock_out_at,
          'status', v_log.status,
          'break_minutes', v_log.break_minutes,
          'regular_minutes', v_log.regular_minutes,
          'overtime_minutes', v_log.overtime_minutes,
          'night_minutes', v_log.night_minutes
        )
      );
    end if;

    if v_shift.id is not null
      and v_local_time > (v_shift.start_time + interval '10 minutes')::time
    then
      v_status := 'late';
    end if;

    insert into public.staff_attendance_logs (
      staff_profile_id,
      shift_id,
      work_date,
      clock_in_at,
      break_minutes,
      status,
      created_by
    )
    values (
      v_identity.staff_profile_id,
      v_shift.id,
      v_work_date,
      p_now,
      coalesce(v_shift.break_minutes, 0),
      v_status,
      v_identity.staff_profile_id
    )
    returning * into v_log;

    insert into public.staff_zalo_attendance_events (
      identity_id,
      staff_profile_id,
      attendance_log_id,
      event_type,
      event_at,
      event_payload
    )
    values (
      v_identity.id,
      v_identity.staff_profile_id,
      v_log.id,
      'clock_in',
      p_now,
      jsonb_build_object('shift_id', v_shift.id, 'status', v_status)
    );
  else
    select *
    into v_log
    from public.staff_attendance_logs
    where staff_profile_id = v_identity.staff_profile_id
      and clock_in_at is not null
      and clock_out_at is null
      and deleted_at is null
      and status not in ('absent', 'no_show', 'leave', 'holiday')
    order by clock_in_at desc
    limit 1
    for update;

    if not found then
      raise exception 'There is no open attendance shift to clock out.';
    end if;

    if v_log.shift_id is not null then
      select * into v_shift
      from public.staff_schedule_shifts
      where id = v_log.shift_id;
    end if;

    v_worked_minutes := greatest(
      0,
      floor(extract(epoch from (p_now - v_log.clock_in_at)) / 60)::integer
        - coalesce(v_log.break_minutes, 0)
    );

    if v_shift.id is not null then
      v_scheduled_minutes := greatest(
        0,
        floor(
          extract(epoch from (
            (v_shift.shift_date + v_shift.end_time
              + case when v_shift.end_time <= v_shift.start_time then interval '1 day' else interval '0 day' end)
            - (v_shift.shift_date + v_shift.start_time)
          )) / 60
        )::integer - coalesce(v_shift.break_minutes, 0)
      );
    else
      v_scheduled_minutes := v_standard_daily_minutes;
    end if;

    v_regular_minutes := least(v_worked_minutes, greatest(0, v_scheduled_minutes));
    v_overtime_minutes := greatest(0, v_worked_minutes - v_regular_minutes);

    select coalesce(sum(overlap_minutes), 0)::integer
    into v_night_minutes
    from (
      select greatest(
        0,
        floor(extract(epoch from (
          least(p_now, night_end_at) - greatest(v_log.clock_in_at, night_start_at)
        )) / 60)::integer
      ) as overlap_minutes
      from (
        select
          ((night_date + v_night_start) at time zone 'Asia/Ho_Chi_Minh') as night_start_at,
          ((night_date + v_night_end
            + case when v_night_end <= v_night_start then interval '1 day' else interval '0 day' end)
            at time zone 'Asia/Ho_Chi_Minh') as night_end_at
        from (
          select
            ((v_log.clock_in_at at time zone 'Asia/Ho_Chi_Minh')::date - 1 + day_offset) as night_date
          from generate_series(
            0,
            greatest(
              1,
              (p_now at time zone 'Asia/Ho_Chi_Minh')::date
                - (v_log.clock_in_at at time zone 'Asia/Ho_Chi_Minh')::date
                + 1
            )
          ) as day_offset
        ) dates
      ) windows
      where least(p_now, night_end_at) > greatest(v_log.clock_in_at, night_start_at)
    ) overlap_rows;

    update public.staff_attendance_logs
    set clock_out_at = p_now,
        regular_minutes = v_regular_minutes,
        overtime_minutes = v_overtime_minutes,
        night_minutes = least(v_worked_minutes, greatest(0, v_night_minutes))
    where id = v_log.id
    returning * into v_log;

    insert into public.staff_zalo_attendance_events (
      identity_id,
      staff_profile_id,
      attendance_log_id,
      event_type,
      event_at,
      event_payload
    )
    values (
      v_identity.id,
      v_identity.staff_profile_id,
      v_log.id,
      'clock_out',
      p_now,
      jsonb_build_object(
        'regular_minutes', v_regular_minutes,
        'overtime_minutes', v_overtime_minutes,
        'night_minutes', v_log.night_minutes
      )
    );
  end if;

  update public.staff_zalo_identities
  set last_seen_at = p_now
  where id = v_identity.id;

  return jsonb_build_object(
    'idempotent', false,
    'action', p_action,
    'employee_profile_id', v_identity.staff_profile_id,
    'attendance_log', jsonb_build_object(
      'id', v_log.id,
      'work_date', v_log.work_date,
      'clock_in_at', v_log.clock_in_at,
      'clock_out_at', v_log.clock_out_at,
      'status', v_log.status,
      'break_minutes', v_log.break_minutes,
      'regular_minutes', v_log.regular_minutes,
      'overtime_minutes', v_log.overtime_minutes,
      'night_minutes', v_log.night_minutes
    )
  );
end;
$$;


ALTER FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_latitude" double precision, "p_longitude" double precision, "p_location_provider" "text", "p_now" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_settings public.staff_zalo_settings%rowtype;
  v_location public.staff_check_in_locations%rowtype;
  v_distance_meters double precision;
  v_result jsonb;
  v_log_id uuid;
  v_idempotent boolean := false;
begin
  if p_action not in ('clock_in', 'clock_out') then
    raise exception 'Unsupported attendance action.';
  end if;

  select *
  into v_settings
  from public.staff_zalo_settings
  where id = 'default';

  if not found or not v_settings.enabled then
    raise exception 'Zalo employee attendance is disabled.';
  end if;

  if v_settings.require_location then
    if p_latitude is null
      or p_longitude is null
      or p_latitude not between -90 and 90
      or p_longitude not between -180 and 180
    then
      raise exception 'A current location is required to record attendance.';
    end if;

    select location.*
    into v_location
    from public.staff_check_in_locations as location
    where location.active = true
      and location.deleted_at is null
    order by 6371000 * acos(
      least(1, greatest(-1,
        cos(radians(p_latitude))
          * cos(radians(location.latitude))
          * cos(radians(location.longitude) - radians(p_longitude))
        + sin(radians(p_latitude))
          * sin(radians(location.latitude))
      ))
    ) asc
    limit 1;

    if not found then
      raise exception 'Attendance location is not configured.';
    end if;

    v_distance_meters := 6371000 * acos(
      least(1, greatest(-1,
        cos(radians(p_latitude))
          * cos(radians(v_location.latitude))
          * cos(radians(v_location.longitude) - radians(p_longitude))
        + sin(radians(p_latitude))
          * sin(radians(v_location.latitude))
      ))
    );

    if v_distance_meters > v_location.radius_meters then
      raise exception 'You are outside an approved check-in location.';
    end if;
  end if;

  v_result := public.staff_zalo_attendance_clock(p_identity_id, p_action, p_now);
  v_log_id := nullif(v_result #>> '{attendance_log,id}', '')::uuid;
  v_idempotent := coalesce((v_result ->> 'idempotent')::boolean, false);

  if v_settings.require_location and v_log_id is not null and not v_idempotent then
    if p_action = 'clock_in' then
      update public.staff_attendance_logs
      set
        clock_in_location_id = v_location.id,
        clock_in_distance_meters = round(v_distance_meters)::integer
      where id = v_log_id;
    else
      update public.staff_attendance_logs
      set
        clock_out_location_id = v_location.id,
        clock_out_distance_meters = round(v_distance_meters)::integer
      where id = v_log_id;
    end if;

    update public.staff_zalo_attendance_events
    set event_payload = event_payload || jsonb_build_object(
      'location_id', v_location.id,
      'location_name', v_location.name,
      'distance_meters', round(v_distance_meters)::integer,
      'location_provider', nullif(left(coalesce(p_location_provider, ''), 40), '')
    )
    where attendance_log_id = v_log_id
      and event_type = p_action
      and event_at = p_now;
  end if;

  return v_result || jsonb_build_object(
    'location', case
      when v_settings.require_location then jsonb_build_object(
        'id', v_location.id,
        'name', v_location.name,
        'distance_meters', round(v_distance_meters)::integer,
        'radius_meters', v_location.radius_meters
      )
      else null
    end
  );
end;
$$;


ALTER FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_latitude" double precision, "p_longitude" double precision, "p_location_provider" "text", "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_challenge_invite_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = old.status then
    return new;
  end if;

  update public.sessions
  set challenge_status = case
        when new.status = 'accepted' then 'accepted'
        when new.status = 'declined' then 'declined'
        else challenge_status
      end,
      challenge_accepted_at = case
        when new.status = 'accepted' then now()
        else challenge_accepted_at
      end,
      challenge_declined_at = case
        when new.status = 'declined' then now()
        else challenge_declined_at
      end
  where id = new.session_id
    and booking_type = 'challenge'
    and challenge_target_id = new.recipient_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_challenge_invite_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_public_snapshot"("p_profile_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."sync_profile_public_snapshot"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_session_participant_legacy_hits"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    new.hits := coalesce(new.hits, new.projectiles_fired);
    new.projectiles_fired := coalesce(new.hits, new.projectiles_fired);
    return new;
  end if;

  if new.hits is distinct from old.hits then
    new.projectiles_fired := new.hits;
  elsif new.projectiles_fired is distinct from old.projectiles_fired then
    new.hits := new.projectiles_fired;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_session_participant_legacy_hits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_automatic_discount_quote"("p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text" DEFAULT NULL::"text", "p_player_count" integer DEFAULT NULL::integer, "p_start_time" time without time zone DEFAULT NULL::time without time zone, "p_ticket_type" "text" DEFAULT NULL::"text") RETURNS TABLE("discount_rule_id" "uuid", "discount_name" "text", "discount_amount" integer, "price_rule_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
  v_requested_price_rule_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

  return query
  select
    d.id,
    d.name,
    public.staff_discount_rule_amount(d.discount_type, d.value, v_subtotal, p_unit_price, d.max_discount_amount),
    v_requested_price_rule_id
  from public.staff_discount_rules d
  where d.code is null
    and d.active = true
    and d.valid_from <= p_booking_date
    and (d.valid_until is null or d.valid_until >= p_booking_date)
    and (d.max_uses is null or d.used_count < d.max_uses)
    and public.staff_discount_rule_matches_context(
      d.game_id,
      d.price_rule_id,
      d.min_players,
      d.max_players,
      d.day_scope,
      d.time_start,
      d.time_end,
      d.ticket_type,
      d.min_order_total,
      d.per_customer_limit,
      d.id,
      p_game_id,
      v_requested_price_rule_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      auth.uid()
    )
    and public.staff_discount_rule_amount(d.discount_type, d.value, v_subtotal, p_unit_price, d.max_discount_amount) > 0
  order by
    public.staff_discount_rule_amount(d.discount_type, d.value, v_subtotal, p_unit_price, d.max_discount_amount) desc,
    d.valid_from desc,
    d.name asc
  limit 1;
end;
$$;


ALTER FUNCTION "public"."ticket_automatic_discount_quote"("p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_booking_start_is_past"("p_date" "date", "p_start_time" time without time zone, "p_now" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "sql" STABLE STRICT
    SET "search_path" TO ''
    AS $$
  select ((p_date + p_start_time) at time zone 'Asia/Ho_Chi_Minh') <= p_now;
$$;


ALTER FUNCTION "public"."ticket_booking_start_is_past"("p_date" "date", "p_start_time" time without time zone, "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_discount_code_quote"("p_code" "text", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text" DEFAULT NULL::"text", "p_player_count" integer DEFAULT NULL::integer, "p_start_time" time without time zone DEFAULT NULL::time without time zone, "p_ticket_type" "text" DEFAULT NULL::"text") RETURNS TABLE("discount_code" "text", "discount_name" "text", "discount_amount" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_discount public.staff_discount_rules%rowtype;
  v_discount_amount integer := 0;
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
  v_requested_price_rule_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  if v_code is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  perform public.consume_rate_limit(
    'voucher_quote',
    20,
    600,
    'quote:' || auth.uid()::text
  );

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

  select *
  into v_discount
  from public.staff_discount_rules
  where code is not null
    and lower(btrim(code)) = lower(v_code)
    and active = true
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (max_uses is null or used_count < max_uses)
    and public.staff_discount_rule_matches_context(
      game_id,
      price_rule_id,
      min_players,
      max_players,
      day_scope,
      time_start,
      time_end,
      ticket_type,
      min_order_total,
      per_customer_limit,
      id,
      p_game_id,
      v_requested_price_rule_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      auth.uid()
    )
  order by created_at desc
  limit 1;

  if not found then
    perform public.consume_rate_limit(
      'voucher_quote',
      5,
      600,
      'invalid:' || auth.uid()::text || ':' || left(v_code, 64)
    );
    return;
  end if;

  v_discount_amount := public.staff_discount_rule_amount(
    v_discount.discount_type,
    v_discount.value,
    v_subtotal,
    p_unit_price,
    v_discount.max_discount_amount
  );

  if v_discount_amount <= 0 then
    perform public.consume_rate_limit(
      'voucher_quote',
      5,
      600,
      'invalid:' || auth.uid()::text || ':' || left(v_code, 64)
    );
    return;
  end if;

  return query
  select v_discount.code, v_discount.name, v_discount_amount;
end;
$$;


ALTER FUNCTION "public"."ticket_discount_code_quote"("p_code" "text", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_loyalty_earn_quote"("p_game_id" "text" DEFAULT NULL::"text", "p_booking_date" "date" DEFAULT CURRENT_DATE, "p_paid_total" integer DEFAULT 0, "p_player_count" integer DEFAULT 1) RETURNS TABLE("estimated_points" integer, "estimated_reduction_vnd" integer, "redeem_value_vnd_per_point" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_paid_total integer := greatest(0, coalesce(p_paid_total, 0));
  v_player_count integer := greatest(0, coalesce(p_player_count, 0));
  v_booking_date date := coalesce(p_booking_date, current_date);
  v_points integer := 0;
  v_redeem_value integer := 0;
  v_rule public.staff_loyalty_rules%rowtype;
begin
  select *
  into v_rule
  from public.staff_loyalty_rules
  where active = true
    and earn_trigger = 'session_payment_confirmed'
    and valid_from <= v_booking_date
    and (valid_until is null or valid_until >= v_booking_date)
    and public.staff_loyalty_rule_matches_game(game_id, p_game_id)
    and v_paid_total >= min_order_total
  order by updated_at desc, created_at desc
  limit 1;

  if found then
    v_points := greatest(0, coalesce(case v_rule.calculation_type
      when 'per_vnd_spent' then floor((v_paid_total::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(v_player_count::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end, 0));
  end if;

  select coalesce(r.redeem_value_vnd_per_point, 0)
  into v_redeem_value
  from public.staff_loyalty_rules r
  where r.active = true
    and r.redeem_value_vnd_per_point > 0
    and r.valid_from <= v_booking_date
    and (r.valid_until is null or r.valid_until >= v_booking_date)
    and public.staff_loyalty_rule_matches_game(r.game_id, p_game_id)
  order by r.updated_at desc, r.created_at desc
  limit 1;

  return query
  select
    v_points::integer,
    (v_points * coalesce(v_redeem_value, 0))::integer,
    coalesce(v_redeem_value, 0)::integer;
end;
$$;


ALTER FUNCTION "public"."ticket_loyalty_earn_quote"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text" DEFAULT NULL::"text", "p_booking_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("loyalty_points_total" integer, "redeem_value_vnd_per_point" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Login required.';
  end if;

  return query
  select
    coalesce(p.loyalty_points_total, 0)::integer as loyalty_points_total,
    coalesce((
      select r.redeem_value_vnd_per_point
      from public.staff_loyalty_rules r
      where r.active = true
        and r.redeem_value_vnd_per_point > 0
        and r.valid_from <= coalesce(p_booking_date, current_date)
        and (r.valid_until is null or r.valid_until >= coalesce(p_booking_date, current_date))
        and public.staff_loyalty_rule_matches_game(r.game_id, p_game_id)
      order by r.updated_at desc, r.created_at desc
      limit 1
    ), 0)::integer as redeem_value_vnd_per_point
  from public.profiles p
  where p.id = v_user_id
    and p.deleted_at is null;
end;
$$;


ALTER FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text" DEFAULT NULL::"text", "p_booking_date" "date" DEFAULT CURRENT_DATE, "p_paid_total" integer DEFAULT 0, "p_player_count" integer DEFAULT 0) RETURNS TABLE("loyalty_points_total" integer, "redeem_value_vnd_per_point" integer, "estimated_points_earned" integer, "estimated_next_reduction_vnd" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_booking_date date := coalesce(p_booking_date, current_date);
  v_game_uuid uuid;
  v_paid_total integer := greatest(0, coalesce(p_paid_total, 0));
  v_player_count integer := greatest(0, coalesce(p_player_count, 0));
  v_points integer := 0;
  v_redeem_value integer := 0;
  v_rule record;
begin
  if v_user_id is null then
    raise exception 'Login required.';
  end if;

  select g.id
  into v_game_uuid
  from public.staff_games g
  where p_game_id is not null
    and (g.id::text = p_game_id or g.slug = p_game_id)
  limit 1;

  select coalesce(max(r.redeem_value_vnd_per_point), 0)::integer
  into v_redeem_value
  from public.staff_loyalty_rules r
  where r.active = true
    and r.redeem_value_vnd_per_point > 0
    and r.valid_from <= v_booking_date
    and (r.valid_until is null or r.valid_until >= v_booking_date)
    and (r.game_id is null or r.game_id = v_game_uuid);

  for v_rule in
    select *
    from public.staff_loyalty_rules r
    where r.active = true
      and r.earn_trigger = 'session_payment_confirmed'
      and r.valid_from <= v_booking_date
      and (r.valid_until is null or r.valid_until >= v_booking_date)
      and (r.game_id is null or r.game_id = v_game_uuid)
      and v_paid_total >= r.min_order_total
  loop
    v_points := v_points + case v_rule.calculation_type
      when 'per_vnd_spent' then floor((v_paid_total::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(v_player_count::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end;
  end loop;

  return query
  select
    coalesce(p.loyalty_points_total, 0)::integer as loyalty_points_total,
    coalesce(v_redeem_value, 0)::integer as redeem_value_vnd_per_point,
    greatest(0, coalesce(v_points, 0))::integer as estimated_points_earned,
    (greatest(0, coalesce(v_points, 0)) * coalesce(v_redeem_value, 0))::integer as estimated_next_reduction_vnd
  from public.profiles p
  where p.id = v_user_id
    and p.deleted_at is null;
end;
$$;


ALTER FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_minimum_duration_minutes"("p_venue_key" "text", "p_date" "date", "p_player_count" integer, "p_arena_count" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  select ceil(p_player_count::numeric / (
    p_arena_count * case when p_venue_key = 'cafe-des-stagiaires' then 8 else 4 end
  ))::integer * public.ticket_tariff_price_block_minutes(p_date);
$$;


ALTER FUNCTION "public"."ticket_minimum_duration_minutes"("p_venue_key" "text", "p_date" "date", "p_player_count" integer, "p_arena_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_tariff_price_block_minutes"("p_booking_date" "date") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case when p_booking_date < date '2026-08-31' then 20 else 45 end;
$$;


ALTER FUNCTION "public"."ticket_tariff_price_block_minutes"("p_booking_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_tariff_unit_price"("p_venue_key" "text", "p_ticket_type" "text", "p_booking_date" "date", "p_start_time" time without time zone) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when p_ticket_type <> 'individual' then 0
    when p_booking_date < date '2026-08-31' and extract(dow from p_booking_date)::integer in (0, 6) then 330000
    when p_booking_date < date '2026-08-31' and p_start_time >= time '18:00' then 250000
    when p_booking_date < date '2026-08-31' then 200000
    when p_venue_key = 'cafe-des-stagiaires' and p_start_time >= time '20:00' then 290000
    when p_venue_key = 'cafe-des-stagiaires' and extract(dow from p_booking_date)::integer in (0, 6) then 240000
    when p_venue_key = 'cafe-des-stagiaires' and p_start_time >= time '16:00' then 240000
    when p_venue_key = 'cafe-des-stagiaires' then 190000
    when extract(dow from p_booking_date)::integer in (0, 6) and p_start_time >= time '20:00' then 390000
    when extract(dow from p_booking_date)::integer in (0, 6) then 330000
    when p_start_time >= time '20:00' then 290000
    when p_start_time >= time '16:00' then 260000
    else 220000
  end;
$$;


ALTER FUNCTION "public"."ticket_tariff_unit_price"("p_venue_key" "text", "p_ticket_type" "text", "p_booking_date" "date", "p_start_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_club_ownership"("p_club_id" "uuid", "p_new_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_previous_owner_id uuid;
begin
  select owner_id
  into v_previous_owner_id
  from public.clubs
  where id = p_club_id
  for update;

  if v_previous_owner_id is null then
    raise exception 'Club not found';
  end if;

  if not (public.is_vrena_admin() or v_previous_owner_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.club_members
    where club_id = p_club_id
      and profile_id = p_new_owner_id
      and status = 'approved'
  ) then
    raise exception 'New owner must be an approved member';
  end if;

  update public.clubs
  set owner_id = p_new_owner_id,
      updated_at = now()
  where id = p_club_id;

  update public.club_members
  set status = 'approved',
      role = 'admin'
  where club_id = p_club_id
    and profile_id in (v_previous_owner_id, p_new_owner_id);
end;
$$;


ALTER FUNCTION "public"."transfer_club_ownership"("p_club_id" "uuid", "p_new_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_matched_venue_result_check_in"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.match_status <> 'session_matched' then
    return new;
  end if;

  update public.session_participants
  set checked_in = true,
      checked_in_at = coalesce(checked_in_at, new.captured_at),
      updated_at = now()
  where id = new.matched_participant_id
    and session_id = new.matched_session_id
    and profile_id = new.profile_id
    and deleted_at is null;

  if not found then
    raise exception 'Matched participant is no longer available.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_matched_venue_result_check_in"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vrena_delete_session_scoped_rows"("p_table_name" "text", "p_session_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_deleted integer := 0;
begin
  if p_session_ids is null or cardinality(p_session_ids) = 0 then
    return 0;
  end if;

  if to_regclass(format('public.%I', p_table_name)) is null then
    return 0;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table_name
      and column_name = 'session_id'
  ) then
    return 0;
  end if;

  execute format('delete from public.%I where session_id = any ($1)', p_table_name)
  using p_session_ids;
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$_$;


ALTER FUNCTION "public"."vrena_delete_session_scoped_rows"("p_table_name" "text", "p_session_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vrena_seed_official_weekly_sessions"("p_seed_batch" "text" DEFAULT 'official-weekly-vrena-2026-06-17'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_owner_id uuid;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_current_time time := (now() at time zone 'Asia/Ho_Chi_Minh')::time;
  v_fallback_phone text;
  v_updated integer := 0;
  v_inserted integer := 0;
  v_result jsonb := '{}'::jsonb;
begin
  select profiles.id
  into v_owner_id
  from public.profiles
  where lower(profiles.email) = 'contact@vre-vietnam.com'
  limit 1;

  if v_owner_id is null then
    select users.id
    into v_owner_id
    from auth.users
    where lower(users.email) = 'contact@vre-vietnam.com'
    limit 1;
  end if;

  if v_owner_id is null then
    raise exception 'contact@vre-vietnam.com was not found in auth.users or public.profiles. Create/log in that user before seeding official sessions.';
  end if;

  v_fallback_phone := '+84' || substring(regexp_replace(v_owner_id::text, '[^0-9]', '', 'g') || '0000000000' from 1 for 10);

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    role,
    updated_at
  ) values (
    v_owner_id,
    v_fallback_phone,
    'VRena Admin',
    'VRena',
    'contact@vre-vietnam.com',
    'admin',
    now()
  )
  on conflict (id) do update
  set role = 'admin',
      email = coalesce(nullif(public.profiles.email, ''), excluded.email),
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      nickname = coalesce(public.profiles.nickname, excluded.nickname),
      updated_at = now();

  create temp table if not exists vrena_official_weekly_schedule (
    sort_order integer primary key,
    day_name text not null,
    day_of_week integer not null,
    start_time time not null,
    name text not null,
    target text not null,
    game_options text[] not null,
    default_game text not null
  ) on commit drop;

  truncate table vrena_official_weekly_schedule;

  insert into vrena_official_weekly_schedule (
    sort_order,
    day_name,
    day_of_week,
    start_time,
    name,
    target,
    game_options,
    default_game
  ) values
    (1, 'Monday', 1, time '10:00', 'Morning VR Starter / Khởi Động VR Buổi Sáng', 'First-time players, quiet groups, tourists', array['laser-tag','mini-block-towers','snow-battle'], 'laser-tag'),
    (2, 'Monday', 1, time '18:30', 'First-Time Players / Lần Đầu Vào Game', 'New users, beginners, casual friends', array['laser-tag','snow-battle','paintball'], 'laser-tag'),
    (3, 'Monday', 1, time '20:00', 'Club Practice / Luyện Đội Club', 'Regular players, clubs, returning users', array['laser-tag','paintball','wild-west','office-war'], 'laser-tag'),
    (4, 'Tuesday', 2, time '10:00', 'Ladies Morning VR / VR Buổi Sáng Hội Bạn Gái', 'Ladies 35-45, premium social groups', array['joller-house','arc-of-the-covenant','snow-battle'], 'joller-house'),
    (5, 'Tuesday', 2, time '18:30', 'First-Time Players / Lần Đầu Vào Game', 'New users, students, casual groups', array['laser-tag','mini-block-towers','paintball'], 'laser-tag'),
    (6, 'Tuesday', 2, time '20:00', 'Ladies VR Night / Đêm VR Hội Bạn Gái', 'Ladies 35-45, after-work friends', array['laser-tag','snow-battle','joller-house'], 'laser-tag'),
    (7, 'Wednesday', 3, time '10:00', 'Student Group Slot / Suất Nhóm Học Sinh', 'Students, school groups, young players', array['laser-tag','mini-block-towers','paintball'], 'mini-block-towers'),
    (8, 'Wednesday', 3, time '18:30', 'Corporate Afterwork / Tan Làm Vào Trận', 'Office workers, team building, adults', array['office-war','paintball','laser-tag'], 'office-war'),
    (9, 'Wednesday', 3, time '20:00', 'First-Time Players / Lần Đầu Vào Game', 'Beginners, mixed groups, couples', array['laser-tag','snow-battle','joller-house'], 'laser-tag'),
    (10, 'Thursday', 4, time '10:00', 'Ladies Morning VR / VR Buổi Sáng Hội Bạn Gái', 'Ladies 35-45, relaxed premium groups', array['joller-house','arc-of-the-covenant','snow-battle'], 'joller-house'),
    (11, 'Thursday', 4, time '18:30', 'Ladies VR Night / Đêm VR Hội Bạn Gái', 'Ladies 35-45, friend groups', array['laser-tag','snow-battle','joller-house'], 'laser-tag'),
    (12, 'Thursday', 4, time '20:00', 'Team Challenge / Thử Thách Đồng Đội', 'Regular players, clubs, competitive groups', array['laser-tag','paintball','wild-west','castle-unspunnen'], 'paintball'),
    (13, 'Friday', 5, time '10:00', 'Birthday Squad / Biệt Đội Sinh Nhật', 'Birthday groups, private groups', array['laser-tag','paintball','snow-battle','joller-house'], 'laser-tag'),
    (14, 'Friday', 5, time '18:30', 'Birthday Squad / Biệt Đội Sinh Nhật', 'Celebration groups, friends, families', array['laser-tag','paintball','snow-battle','joller-house'], 'laser-tag'),
    (15, 'Friday', 5, time '20:30', 'Friday Night Battle / Đại Chiến Tối Thứ Sáu', 'Teenagers, young adults, competitive players', array['laser-tag','paintball','wild-west','office-war'], 'laser-tag'),
    (16, 'Saturday', 6, time '10:00', 'Family Morning Challenge / Thử Thách Gia Đình Buổi Sáng', 'Families, parents, kids, early mall visitors', array['snow-battle','mini-block-towers','laser-tag'], 'snow-battle'),
    (17, 'Saturday', 6, time '16:00', 'Family Challenge / Thử Thách Gia Đình', 'Families, mixed generations, casual groups', array['snow-battle','laser-tag','joller-house'], 'snow-battle'),
    (18, 'Saturday', 6, time '19:30', 'Social Battle / Đại Chiến Hội Bạn', 'Friends, birthdays, young adults', array['laser-tag','paintball','wild-west','snow-battle'], 'laser-tag'),
    (19, 'Sunday', 0, time '10:00', 'Family Morning Challenge / Thử Thách Gia Đình Buổi Sáng', 'Families, kids, relaxed groups', array['snow-battle','mini-block-towers','laser-tag'], 'snow-battle'),
    (20, 'Sunday', 0, time '16:00', 'Family Challenge / Thử Thách Gia Đình', 'Families, parents, teens', array['snow-battle','laser-tag','joller-house'], 'snow-battle'),
    (21, 'Sunday', 0, time '18:00', 'Easy Social Game / Vào Trận Vui Vẻ', 'Beginners, casual groups, people preparing for Monday', array['laser-tag','snow-battle','joller-house'], 'laser-tag');

  create temp table if not exists vrena_official_weekly_occurrences (
    sort_order integer not null,
    occurrence_date date not null,
    start_time time not null,
    name text not null,
    notes text not null,
    game_options text[] not null,
    default_game text not null,
    primary key (sort_order, occurrence_date)
  ) on commit drop;

  truncate table vrena_official_weekly_occurrences;

  insert into vrena_official_weekly_occurrences (
    sort_order,
    occurrence_date,
    start_time,
    name,
    notes,
    game_options,
    default_game
  )
  select
    schedule.sort_order,
    v_today
      + (
        ((schedule.day_of_week - extract(dow from v_today)::integer + 7) % 7)
        + case
          when ((schedule.day_of_week - extract(dow from v_today)::integer + 7) % 7) = 0
            and schedule.start_time <= v_current_time
          then 7
          else 0
        end
        + (week_index * 7)
      ),
    schedule.start_time,
    schedule.name,
    '<p><strong>Official VRena community session.</strong></p>'
      || '<p>Schedule: ' || schedule.day_name || ' ' || to_char(schedule.start_time, 'HH24:MI') || '.</p>'
      || '<p>Best for: ' || schedule.target || '.</p>'
      || '<p>Join the table, vote the game, and pay onsite at reception.</p>',
    schedule.game_options,
    schedule.default_game
  from vrena_official_weekly_schedule schedule
  cross join generate_series(0, 3) as week_index;

  update public.sessions existing
  set owner_id = v_owner_id,
      club_id = null,
      session_type = 'game',
      duration_minutes = 40,
      max_players = 16,
      arena_count = 2,
      game_options = occurrences.game_options,
      game_votes = jsonb_build_object(v_owner_id::text, occurrences.default_game),
      confirmed_game_id = null,
      visibility = 'public',
      invite_code = null,
      notes = occurrences.notes,
      status = 'open',
      tournament_format = null,
      best_of = 1,
      rounds_per_match = null,
      require_payment = false,
      qualification_rule = null,
      custom_qualifiers = null,
      enable_third_place_match = false,
      first_prize = null,
      second_prize = null,
      third_prize = null,
      tournament_locked = false,
      seeded = true,
      seed_batch = p_seed_batch,
      seed_label = 'Official VRena',
      seeded_at = coalesce(existing.seeded_at, now()),
      booking_type = 'community',
      ticket_type = null,
      ticket_player_count = null,
      ticket_unit_price = null,
      ticket_total_price = null,
      ticket_status = null,
      ticket_reference = null,
      ticket_customer_id = null
  from vrena_official_weekly_occurrences occurrences
  where existing.seeded is true
    and existing.seed_batch = p_seed_batch
    and existing.date = occurrences.occurrence_date
    and existing.start_time = occurrences.start_time
    and existing.name = occurrences.name;
  get diagnostics v_updated = row_count;

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    seeded,
    seed_batch,
    seed_label,
    seeded_at,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  )
  select
    v_owner_id,
    null,
    'game',
    occurrences.name,
    occurrences.occurrence_date,
    occurrences.start_time,
    40,
    16,
    2,
    occurrences.game_options,
    jsonb_build_object(v_owner_id::text, occurrences.default_game),
    null,
    'public',
    null,
    occurrences.notes,
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    true,
    p_seed_batch,
    'Official VRena',
    now(),
    'community',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  from vrena_official_weekly_occurrences occurrences
  where not exists (
    select 1
    from public.sessions existing
    where existing.seeded is true
      and existing.seed_batch = p_seed_batch
      and existing.date = occurrences.occurrence_date
      and existing.start_time = occurrences.start_time
      and existing.name = occurrences.name
  );
  get diagnostics v_inserted = row_count;

  v_result := jsonb_build_object(
    'admin_profile_id', v_owner_id,
    'admin_email', 'contact@vre-vietnam.com',
    'seed_batch', p_seed_batch,
    'official_sessions_updated', v_updated,
    'official_sessions_inserted', v_inserted
  );

  raise notice 'VRena official weekly sessions seed complete: %', v_result;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."vrena_seed_official_weekly_sessions"("p_seed_batch" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vrena_soft_launch_prepare_demo_auth_users"("p_allow_production_seed" boolean DEFAULT false, "p_seed_batch" "text" DEFAULT 'soft-launch-2026-06-16'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_inserted integer := 0;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch demo auth preparation refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'Missing required table auth.users.';
  end if;

  drop table if exists pg_temp.vrena_seed_auth_users;
  create temp table vrena_seed_auth_users (
    id uuid primary key,
    phone text not null,
    full_name text not null,
    nickname text not null,
    email text not null
  ) on commit drop;

  insert into vrena_seed_auth_users values
    ('00000000-0000-4000-8000-000000000101', '+84000000101', 'VRena Rookie', 'Rookie', 'softlaunch-rookie@vrena.demo'),
    ('00000000-0000-4000-8000-000000000102', '+84000000102', 'Ha Do Hunter', 'Ha Do', 'softlaunch-hado@vrena.demo'),
    ('00000000-0000-4000-8000-000000000103', '+84000000103', 'Neon Noodle', 'Neon', 'softlaunch-neon@vrena.demo'),
    ('00000000-0000-4000-8000-000000000104', '+84000000104', 'Byte Bender', 'Byte', 'softlaunch-byte@vrena.demo'),
    ('00000000-0000-4000-8000-000000000105', '+84000000105', 'Saigon Spark', 'Saigon', 'softlaunch-saigon@vrena.demo'),
    ('00000000-0000-4000-8000-000000000106', '+84000000106', 'Arena Ace', 'Ace', 'softlaunch-ace@vrena.demo'),
    ('00000000-0000-4000-8000-000000000107', '+84000000107', 'Joller Runner', 'Joller', 'softlaunch-joller@vrena.demo'),
    ('00000000-0000-4000-8000-000000000108', '+84000000108', 'Arc Whisper', 'Arc', 'softlaunch-arc@vrena.demo'),
    ('00000000-0000-4000-8000-000000000109', '+84000000109', 'Paint Pop', 'Paint', 'softlaunch-paint@vrena.demo'),
    ('00000000-0000-4000-8000-000000000110', '+84000000110', 'Snow Slider', 'Snow', 'softlaunch-snow@vrena.demo'),
    ('00000000-0000-4000-8000-000000000111', '+84000000111', 'Office Ninja', 'Office', 'softlaunch-office@vrena.demo'),
    ('00000000-0000-4000-8000-000000000112', '+84000000112', 'Crown Chaser', 'Crown', 'softlaunch-crown@vrena.demo');

  if exists (
    select 1
    from auth.users u
    join vrena_seed_auth_users seed on seed.id = u.id
    where coalesce((u.raw_app_meta_data->>'seed_demo')::boolean, false) is not true
  ) then
    raise exception 'A soft-launch demo auth UUID already belongs to a non-demo auth user. Aborting.';
  end if;

  if exists (
    select 1
    from auth.users u
    join vrena_seed_auth_users seed on lower(u.email) = lower(seed.email)
    where u.id <> seed.id
  ) then
    raise exception 'A soft-launch demo email already belongs to another auth user. Aborting.';
  end if;

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    reauthentication_token
  )
  select
    seed.id,
    'authenticated',
    'authenticated',
    seed.email,
    null,
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'seed_demo', true,
      'seed_batch', p_seed_batch
    ),
    jsonb_build_object(
      'full_name', seed.full_name,
      'nickname', seed.nickname,
      'seed_demo', true,
      'seed_batch', p_seed_batch
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    ''
  from vrena_seed_auth_users seed
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now()
  where coalesce((auth.users.raw_app_meta_data->>'seed_demo')::boolean, false) is true;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'prepared_demo_auth_users', v_inserted,
    'seed_batch', p_seed_batch
  );
end;
$$;


ALTER FUNCTION "public"."vrena_soft_launch_prepare_demo_auth_users"("p_allow_production_seed" boolean, "p_seed_batch" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vrena_soft_launch_reset_seed"("p_allow_production_seed" boolean DEFAULT false, "p_seed_batch" "text" DEFAULT 'soft-launch-2026-06-16'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_session_ids uuid[] := '{}'::uuid[];
  v_known_tables text[] := array[
    'session_invites',
    'session_messages',
    'session_waitlist',
    'tournament_audit_log',
    'tournament_matches',
    'tournament_pool_entries',
    'tournament_pools',
    'tournament_editors',
    'session_participants'
  ];
  v_table text;
  v_deleted integer := 0;
  v_result jsonb := '{}'::jsonb;
  v_seeded_sessions integer := 0;
  v_seeded_participants integer := 0;
  v_seeded_comments integer := 0;
  v_seeded_profiles integer := 0;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch reset refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  if to_regclass('public.sessions') is null then
    raise exception 'Missing required table public.sessions.';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'Missing required table public.profiles.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_session_ids
  from public.sessions;

  foreach v_table in array v_known_tables loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  for v_table in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'session_id'
      and c.table_name <> 'sessions'
      and c.table_name <> all(v_known_tables)
    order by c.table_name
  loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  delete from public.sessions;
  get diagnostics v_deleted = row_count;
  v_result := v_result || jsonb_build_object('deleted_sessions', v_deleted);

  drop table if exists pg_temp.vrena_seed_profiles;
  create temp table vrena_seed_profiles (
    id uuid primary key,
    phone text not null,
    full_name text not null,
    nickname text not null,
    email text not null,
    avatar_emoji text,
    avatar_initials text,
    avatar_color text not null,
    avatar_text_color text not null,
    profile_motto text
  ) on commit drop;

  insert into vrena_seed_profiles values
    ('00000000-0000-4000-8000-000000000101', '+84000000101', 'VRena Rookie', 'Rookie', 'softlaunch-rookie@vrena.demo', '😎', 'VR', '#3059ff', '#ffffff', 'First quest'),
    ('00000000-0000-4000-8000-000000000102', '+84000000102', 'Ha Do Hunter', 'Ha Do', 'softlaunch-hado@vrena.demo', '🎯', 'HD', '#12b6b0', '#071112', 'Calm aim'),
    ('00000000-0000-4000-8000-000000000103', '+84000000103', 'Neon Noodle', 'Neon', 'softlaunch-neon@vrena.demo', '⚡', 'NN', '#7c3aed', '#ffffff', 'Fast feet'),
    ('00000000-0000-4000-8000-000000000104', '+84000000104', 'Byte Bender', 'Byte', 'softlaunch-byte@vrena.demo', '🕹️', 'BB', '#0ea5e9', '#071112', 'Map brain'),
    ('00000000-0000-4000-8000-000000000105', '+84000000105', 'Saigon Spark', 'Saigon', 'softlaunch-saigon@vrena.demo', '✨', 'SS', '#f59e0b', '#071112', 'One more'),
    ('00000000-0000-4000-8000-000000000106', '+84000000106', 'Arena Ace', 'Ace', 'softlaunch-ace@vrena.demo', '🏅', 'AA', '#16a34a', '#ffffff', 'No panic'),
    ('00000000-0000-4000-8000-000000000107', '+84000000107', 'Joller Runner', 'Joller', 'softlaunch-joller@vrena.demo', '🚪', 'JR', '#dc2626', '#ffffff', 'Exit found'),
    ('00000000-0000-4000-8000-000000000108', '+84000000108', 'Arc Whisper', 'Arc', 'softlaunch-arc@vrena.demo', '🧩', 'AW', '#0891b2', '#ffffff', 'Puzzle mode'),
    ('00000000-0000-4000-8000-000000000109', '+84000000109', 'Paint Pop', 'Paint', 'softlaunch-paint@vrena.demo', '🎨', 'PP', '#db2777', '#ffffff', 'Bright hits'),
    ('00000000-0000-4000-8000-000000000110', '+84000000110', 'Snow Slider', 'Snow', 'softlaunch-snow@vrena.demo', '❄️', 'SL', '#38bdf8', '#071112', 'Stay cool'),
    ('00000000-0000-4000-8000-000000000111', '+84000000111', 'Office Ninja', 'Office', 'softlaunch-office@vrena.demo', '☕', 'ON', '#64748b', '#ffffff', 'Desk dodge'),
    ('00000000-0000-4000-8000-000000000112', '+84000000112', 'Crown Chaser', 'Crown', 'softlaunch-crown@vrena.demo', '👑', 'CC', '#facc15', '#071112', 'Top shelf');

  if exists (
    select 1
    from public.profiles p
    join vrena_seed_profiles sp on sp.id = p.id
    where p.is_seed_demo is false
  ) then
    raise exception 'A seed profile UUID already belongs to a non-demo profile. Aborting without modifying profiles.';
  end if;

  if exists (
    select 1
    from public.profiles p
    join vrena_seed_profiles sp on lower(p.email) = lower(sp.email)
    where p.id <> sp.id
  ) then
    raise exception 'A soft-launch demo email is already used by another profile. Aborting without modifying profiles.';
  end if;

  if exists (
    select 1
    from public.profiles p
    join vrena_seed_profiles sp on p.phone = sp.phone
    where p.id <> sp.id
  ) then
    raise exception 'A soft-launch demo phone is already used by another profile. Aborting without modifying profiles.';
  end if;

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    role,
    score_adjustment,
    is_seed_demo,
    seed_batch
  )
  select
    id,
    phone,
    full_name,
    nickname,
    email,
    null,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    'player',
    0,
    true,
    p_seed_batch
  from vrena_seed_profiles
  on conflict (id) do update
  set phone = excluded.phone,
      full_name = excluded.full_name,
      nickname = excluded.nickname,
      email = excluded.email,
      avatar_url = excluded.avatar_url,
      avatar_emoji = excluded.avatar_emoji,
      avatar_initials = excluded.avatar_initials,
      avatar_color = excluded.avatar_color,
      avatar_text_color = excluded.avatar_text_color,
      profile_motto = excluded.profile_motto,
      role = excluded.role,
      score_adjustment = excluded.score_adjustment,
      is_seed_demo = true,
      seed_batch = excluded.seed_batch
  where public.profiles.is_seed_demo = true;
  get diagnostics v_seeded_profiles = row_count;

  drop table if exists pg_temp.vrena_seed_sessions;
  create temp table vrena_seed_sessions (
    id uuid primary key,
    owner_id uuid not null,
    session_type text not null,
    name text not null,
    date_offset integer not null,
    start_time time not null,
    duration_minutes integer not null,
    max_players integer not null,
    arena_count integer not null,
    game_options text[] not null,
    game_votes jsonb not null,
    confirmed_game_id text not null,
    visibility text not null,
    invite_code text,
    notes text,
    tournament_format text,
    best_of integer,
    rounds_per_match integer,
    require_payment boolean,
    qualification_rule text,
    custom_qualifiers integer,
    enable_third_place_match boolean,
    first_prize text,
    second_prize text,
    third_prize text,
    tournament_locked boolean
  ) on commit drop;

  insert into vrena_seed_sessions values
    ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000101', 'game', 'Neon Noodle Warmup', 13, time '18:20', 40, 8, 1, array['laser-tag'], '{"00000000-0000-4000-8000-000000000101":"laser-tag","00000000-0000-4000-8000-000000000103":"laser-tag","00000000-0000-4000-8000-000000000106":"laser-tag"}'::jsonb, 'laser-tag', 'public', null, 'Soft Opening Highlights: quick warmup, bright scoreboard, zero pressure.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000107', 'game', 'Joller House Exit Crew', 12, time '19:00', 40, 6, 1, array['joller-house'], '{"00000000-0000-4000-8000-000000000107":"joller-house","00000000-0000-4000-8000-000000000108":"joller-house"}'::jsonb, 'joller-house', 'private', 'JOLLER', 'Soft Opening Highlights: small escape crew, big hallway theories.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000111', 'game', 'Office War Coffee Raid', 10, time '17:40', 40, 8, 1, array['office-war'], '{"00000000-0000-4000-8000-000000000111":"office-war","00000000-0000-4000-8000-000000000104":"office-war"}'::jsonb, 'office-war', 'public', null, 'Soft Opening Highlights: desk cover, fast laughs, suspicious coffee energy.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000102', 'game', 'Wild West Quickdraw Circus', 9, time '20:00', 40, 8, 1, array['wild-west'], '{"00000000-0000-4000-8000-000000000102":"wild-west","00000000-0000-4000-8000-000000000112":"wild-west"}'::jsonb, 'wild-west', 'private', 'DRAW77', 'Soft Opening Highlights: quickdraw practice with a very loud scoreboard.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000110', 'game', 'Snow Battle Freeze Tag', 7, time '18:40', 40, 8, 1, array['snow-battle'], '{"00000000-0000-4000-8000-000000000110":"snow-battle","00000000-0000-4000-8000-000000000103":"snow-battle"}'::jsonb, 'snow-battle', 'public', null, 'Soft Opening Highlights: cool hands, warm rematch energy.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000109', 'game', 'Paintball Chaos Practice', 6, time '19:20', 60, 10, 2, array['paintball'], '{"00000000-0000-4000-8000-000000000109":"paintball","00000000-0000-4000-8000-000000000110":"paintball"}'::jsonb, 'paintball', 'public', null, 'Soft Opening Highlights: two arenas, bright hits, tidy chaos.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001007', '00000000-0000-4000-8000-000000000108', 'game', 'Arc Vault Brain Run', 5, time '18:00', 40, 5, 1, array['arc-of-the-covenant'], '{"00000000-0000-4000-8000-000000000108":"arc-of-the-covenant","00000000-0000-4000-8000-000000000112":"arc-of-the-covenant"}'::jsonb, 'arc-of-the-covenant', 'private', 'ARC555', 'Soft Opening Highlights: clues, guesses, and one heroic shortcut.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000000104', 'game', 'Mini Block Tower Tilt', 3, time '17:20', 40, 6, 1, array['mini-block-towers'], '{"00000000-0000-4000-8000-000000000104":"mini-block-towers","00000000-0000-4000-8000-000000000105":"mini-block-towers"}'::jsonb, 'mini-block-towers', 'public', null, 'Soft Opening Highlights: compact map, big scoreboard swings.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001009', '00000000-0000-4000-8000-000000000106', 'game', 'Castle Unspunnen Shield Run', 2, time '20:20', 40, 8, 1, array['castle-unspunnen'], '{"00000000-0000-4000-8000-000000000106":"castle-unspunnen","00000000-0000-4000-8000-000000000112":"castle-unspunnen"}'::jsonb, 'castle-unspunnen', 'public', null, 'Soft Opening Highlights: careful corners, bold pushes, clean finish.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000000112', 'tournament', 'VRena Crown Scramble', 1, time '18:00', 60, 8, 2, array['laser-tag','paintball'], '{"00000000-0000-4000-8000-000000000112":"laser-tag","00000000-0000-4000-8000-000000000103":"paintball","00000000-0000-4000-8000-000000000102":"laser-tag"}'::jsonb, 'laser-tag', 'public', null, 'Soft Opening Highlights: a compact tournament board for new players to understand the flow.', 'pool_to_final', 3, 1, false, 'top_1', 2, true, 'Free session', 'VRena drink', 'Sticker pack', true);

  insert into public.sessions (
    id,
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    seeded,
    seed_batch,
    seed_label,
    seeded_at
  )
  select
    id,
    owner_id,
    null,
    session_type,
    name,
    current_date - date_offset,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    'completed',
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    true,
    p_seed_batch,
    'Soft Opening Highlights',
    now()
  from vrena_seed_sessions;
  get diagnostics v_seeded_sessions = row_count;

  drop table if exists pg_temp.vrena_seed_participants;
  create temp table vrena_seed_participants (
    session_id uuid not null,
    profile_id uuid not null,
    score integer not null,
    accuracy_percent integer not null,
    projectiles_fired integer not null,
    placement integer,
    payment_status text not null,
    payment_amount numeric not null
  ) on commit drop;

  insert into vrena_seed_participants values
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000103',710,42,1180,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000106',580,34,910,2,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000101',620,38,1040,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000104',540,31,880,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000102',480,29,790,null,'free',0),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000109',390,24,650,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000101',390,18,120,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000107',360,16,105,2,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000108',330,14,94,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000110',300,12,82,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000111',660,39,1110,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000105',610,35,980,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000104',570,33,930,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000103',520,28,840,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000102',450,25,760,null,'free',0),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000102',740,44,1210,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000112',690,41,1130,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000106',620,37,1000,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000101',590,35,950,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000107',510,30,870,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000111',430,26,720,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000110',700,40,1090,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000103',640,36,1015,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000105',530,32,900,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000109',450,27,780,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000108',410,24,700,null,'free',0),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000109',820,47,1390,1,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000110',690,39,1160,2,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000102',610,36,1080,3,'bank_transfer',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000111',580,34,1010,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000101',550,32,950,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000106',505,30,880,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000104',470,28,840,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000107',430,25,760,null,'free',0),
    ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000108',520,21,160,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000112',450,18,145,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000103',410,16,132,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000104',730,43,1220,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000105',680,40,1110,2,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000111',500,29,840,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000101',460,27,760,null,'free',0),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000106',760,45,1260,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000112',700,42,1170,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000107',610,36,990,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000110',590,34,940,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000109',555,32,900,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000112',900,51,1510,1,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000103',750,44,1320,2,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000104',710,41,1240,3,'bank_transfer',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000102',680,39,1200,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000106',640,37,1130,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000101',520,30,920,null,'free',0);

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    checked_in,
    payment_status,
    payment_amount,
    score,
    accuracy_percent,
    projectiles_fired,
    placement
  )
  select
    sp.session_id,
    sp.profile_id,
    p.nickname,
    null,
    p.avatar_emoji,
    p.avatar_initials,
    p.avatar_color,
    p.avatar_text_color,
    p.profile_motto,
    true,
    sp.payment_status,
    sp.payment_amount,
    sp.score,
    sp.accuracy_percent,
    sp.projectiles_fired,
    sp.placement
  from vrena_seed_participants sp
  join vrena_seed_profiles p on p.id = sp.profile_id;
  get diagnostics v_seeded_participants = row_count;

  if to_regclass('public.tournament_pools') is not null then
    insert into public.tournament_pools (session_id, name, sort_order) values
      ('00000000-0000-4000-8000-000000001010', 'Pool A', 1),
      ('00000000-0000-4000-8000-000000001010', 'Pool B', 2);
  end if;

  if to_regclass('public.tournament_pool_entries') is not null and to_regclass('public.tournament_pools') is not null then
    insert into public.tournament_pool_entries (session_id, pool_id, participant_id, profile_id, seed, team_label)
    select
      '00000000-0000-4000-8000-000000001010',
      pool.id,
      participant.id,
      seed.profile_id,
      seed.seed,
      seed.team_label
    from (
      values
        ('Pool A', '00000000-0000-4000-8000-000000000112'::uuid, 1, 'Team Crown'),
        ('Pool A', '00000000-0000-4000-8000-000000000104'::uuid, 2, 'Team Byte'),
        ('Pool A', '00000000-0000-4000-8000-000000000106'::uuid, 3, 'Team Ace'),
        ('Pool B', '00000000-0000-4000-8000-000000000103'::uuid, 1, 'Team Neon'),
        ('Pool B', '00000000-0000-4000-8000-000000000102'::uuid, 2, 'Team Ha Do'),
        ('Pool B', '00000000-0000-4000-8000-000000000101'::uuid, 3, 'Team Rookie')
    ) as seed(pool_name, profile_id, seed, team_label)
    join public.tournament_pools pool
      on pool.session_id = '00000000-0000-4000-8000-000000001010'
      and pool.name = seed.pool_name
    join public.session_participants participant
      on participant.session_id = '00000000-0000-4000-8000-000000001010'
      and participant.profile_id = seed.profile_id;
  end if;

  if to_regclass('public.tournament_matches') is not null and to_regclass('public.tournament_pools') is not null then
    insert into public.tournament_matches (
      session_id,
      pool_id,
      stage,
      round,
      match_number,
      participant_a_id,
      participant_b_id,
      score_a,
      score_b,
      wins_a,
      wins_b,
      winner_participant_id,
      loser_participant_id,
      status,
      arena_number,
      queue_position,
      best_of
    )
    select
      '00000000-0000-4000-8000-000000001010',
      pool.id,
      match.stage,
      match.round,
      match.match_number,
      pa.id,
      pb.id,
      match.score_a,
      match.score_b,
      match.wins_a,
      match.wins_b,
      case when match.winner_profile_id = match.profile_a_id then pa.id else pb.id end,
      case when match.winner_profile_id = match.profile_a_id then pb.id else pa.id end,
      'completed',
      match.arena_number,
      match.queue_position,
      3
    from (
      values
        ('Pool A', 'pool', 1, 1, '00000000-0000-4000-8000-000000000112'::uuid, '00000000-0000-4000-8000-000000000104'::uuid, '00000000-0000-4000-8000-000000000112'::uuid, 12, 8, 2, 1, 1, 1),
        ('Pool A', 'pool', 1, 2, '00000000-0000-4000-8000-000000000112'::uuid, '00000000-0000-4000-8000-000000000106'::uuid, '00000000-0000-4000-8000-000000000112'::uuid, 13, 7, 2, 0, 2, 2),
        ('Pool A', 'pool', 1, 3, '00000000-0000-4000-8000-000000000104'::uuid, '00000000-0000-4000-8000-000000000106'::uuid, '00000000-0000-4000-8000-000000000104'::uuid, 10, 9, 2, 1, 1, 3),
        ('Pool B', 'pool', 1, 4, '00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, 11, 9, 2, 1, 2, 4),
        ('Pool B', 'pool', 1, 5, '00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, 12, 6, 2, 0, 1, 5),
        ('Pool B', 'pool', 1, 6, '00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, 10, 8, 2, 1, 2, 6),
        ('Pool A', 'final', 2, 1, '00000000-0000-4000-8000-000000000112'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-4000-8000-000000000112'::uuid, 15, 12, 2, 1, 1, 7)
    ) as match(pool_name, stage, round, match_number, profile_a_id, profile_b_id, winner_profile_id, score_a, score_b, wins_a, wins_b, arena_number, queue_position)
    left join public.tournament_pools pool
      on pool.session_id = '00000000-0000-4000-8000-000000001010'
      and pool.name = match.pool_name
      and match.stage = 'pool'
    join public.session_participants pa
      on pa.session_id = '00000000-0000-4000-8000-000000001010'
      and pa.profile_id = match.profile_a_id
    join public.session_participants pb
      on pb.session_id = '00000000-0000-4000-8000-000000001010'
      and pb.profile_id = match.profile_b_id;
  end if;

  if to_regclass('public.tournament_audit_log') is not null then
    insert into public.tournament_audit_log (session_id, user_id, action, old_value, new_value, created_at)
    values (
      '00000000-0000-4000-8000-000000001010',
      '00000000-0000-4000-8000-000000000112',
      'Soft launch tournament seeded',
      null,
      jsonb_build_object('seed_batch', p_seed_batch, 'label', 'Soft Opening Highlights'),
      now()
    );
  end if;

  if to_regclass('public.session_messages') is not null then
    drop table if exists pg_temp.vrena_seed_comments;
    create temp table vrena_seed_comments (
      session_id uuid not null,
      author_id uuid not null,
      message_type text not null,
      body text not null,
      minute_offset integer not null
    ) on commit drop;

    insert into vrena_seed_comments values
      ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000101','announcement','Soft opening run: quick warmup, then swap teams after round two.',2),
      ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000103','comment','That last corner got busy fast.',18),
      ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000106','comment','Next time I am watching the left lane.',31),
      ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000107','announcement','Small escape crew tonight. Keep clues in the room and theories on the table.',1),
      ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000108','comment','The cabinet clue finally made sense at the end.',17),
      ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000110','comment','I wrote down the wrong number twice. Still fun.',33),
      ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000111','announcement','Coffee Raid starts on time. Winner buys nothing, just brags quietly.',3),
      ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000104','comment','Desk cover saved me for about four seconds.',19),
      ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000105','comment','Good pace. My aim arrived late.',35),
      ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000102','announcement','Private quickdraw night. Rotate after every two rounds.',4),
      ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000112','comment','The scoreboard was a little too honest.',24),
      ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000106','comment','Rematch noted. I need one calmer first round.',38),
      ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000110','announcement','Freeze Tag flow: short rounds, quick reset, no long speeches.',2),
      ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000103','comment','The second round was all timing.',16),
      ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000105','comment','I kept sliding past my own plan.',29),
      ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000109','announcement','Two arenas open. Keep teams moving and call breaks early.',1),
      ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000110','comment','Arena two felt faster today.',21),
      ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000102','comment','Good teams. Paintball got spicy without getting messy.',44),
      ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000108','announcement','Vault run: talk through clues before touching everything at once.',2),
      ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000112','comment','That shortcut felt illegal but apparently worked.',15),
      ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000103','comment','I had the right clue and the wrong confidence.',31),
      ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000104','announcement','Mini Block night. Compact map, fast swaps, tiny drama.',2),
      ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000105','comment','That tower angle was better than expected.',18),
      ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000101','comment','I need a slower first minute next time.',34),
      ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000106','announcement','Shield Run starts with practice shots, then full pace.',3),
      ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000107','comment','The last push was clean.',20),
      ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000109','comment','I got caught looking at the wrong doorway.',32),
      ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000112','announcement','Crown Scramble bracket is seeded. Pool winners go straight to final.',2),
      ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000103','comment','Pool B was closer than the scores make it look.',36),
      ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000104','comment','Final had real noise from the sideline.',58);

    insert into public.session_messages (
      session_id,
      author_id,
      author_display_name,
      author_avatar_url,
      author_avatar_emoji,
      author_avatar_initials,
      author_avatar_color,
      author_avatar_text_color,
      author_profile_motto,
      message_type,
      body,
      moderation_status,
      moderation_reason,
      moderation_categories,
      moderation_score,
      created_at
    )
    select
      sc.session_id,
      sc.author_id,
      p.nickname,
      null,
      p.avatar_emoji,
      p.avatar_initials,
      p.avatar_color,
      p.avatar_text_color,
      p.profile_motto,
      sc.message_type,
      sc.body,
      'approved',
      null,
      '{}'::jsonb,
      0,
      (current_date - ss.date_offset) + ss.start_time + (sc.minute_offset || ' minutes')::interval
    from vrena_seed_comments sc
    join vrena_seed_profiles p on p.id = sc.author_id
    join vrena_seed_sessions ss on ss.id = sc.session_id;
    get diagnostics v_seeded_comments = row_count;
  end if;

  v_result := v_result
    || jsonb_build_object('seeded_profiles_upserted', v_seeded_profiles)
    || jsonb_build_object('seeded_sessions', v_seeded_sessions)
    || jsonb_build_object('seeded_participants', v_seeded_participants)
    || jsonb_build_object('seeded_comments', v_seeded_comments)
    || jsonb_build_object('seed_batch', p_seed_batch)
    || jsonb_build_object('label', 'Soft Opening Highlights');

  return v_result;
end;
$$;


ALTER FUNCTION "public"."vrena_soft_launch_reset_seed"("p_allow_production_seed" boolean, "p_seed_batch" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vrena_soft_launch_reset_seed_with_demo_auth"("p_allow_production_seed" boolean DEFAULT false, "p_seed_batch" "text" DEFAULT 'soft-launch-2026-06-16'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_auth_result jsonb;
  v_seed_result jsonb;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch reset refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  v_auth_result := public.vrena_soft_launch_prepare_demo_auth_users(p_allow_production_seed, p_seed_batch);
  v_seed_result := public.vrena_soft_launch_reset_seed(p_allow_production_seed, p_seed_batch);

  return v_auth_result || v_seed_result;
end;
$$;


ALTER FUNCTION "public"."vrena_soft_launch_reset_seed_with_demo_auth"("p_allow_production_seed" boolean, "p_seed_batch" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vrena_soft_launch_rollback_seed"("p_allow_production_seed" boolean DEFAULT false, "p_seed_batch" "text" DEFAULT 'soft-launch-2026-06-16'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session_ids uuid[] := '{}'::uuid[];
  v_known_tables text[] := array[
    'session_invites',
    'session_messages',
    'session_waitlist',
    'tournament_audit_log',
    'tournament_matches',
    'tournament_pool_entries',
    'tournament_pools',
    'tournament_editors',
    'session_participants'
  ];
  v_table text;
  v_deleted integer := 0;
  v_result jsonb := '{}'::jsonb;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch rollback refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_session_ids
  from public.sessions
  where seeded is true
    and seed_batch = p_seed_batch;

  foreach v_table in array v_known_tables loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  for v_table in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'session_id'
      and c.table_name <> 'sessions'
      and c.table_name <> all(v_known_tables)
    order by c.table_name
  loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  delete from public.sessions
  where seeded is true
    and seed_batch = p_seed_batch;
  get diagnostics v_deleted = row_count;

  return v_result
    || jsonb_build_object('deleted_sessions', v_deleted)
    || jsonb_build_object('seed_batch', p_seed_batch)
    || jsonb_build_object('demo_profiles_retained', (
      select count(*)
      from public.profiles
      where is_seed_demo is true
        and seed_batch = p_seed_batch
    ));
end;
$$;


ALTER FUNCTION "public"."vrena_soft_launch_rollback_seed"("p_allow_production_seed" boolean, "p_seed_batch" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."integration_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "private"."integration_settings" OWNER TO "postgres";


COMMENT ON TABLE "private"."integration_settings" IS 'Private integration configuration. Set google_sheets_webhook_url and google_sheets_webhook_secret after deploying the Google Apps Script web app.';



CREATE TABLE IF NOT EXISTS "private"."staff_kiosk_operator_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "operator_profile_id" "uuid" NOT NULL,
    "access_role" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "user_agent_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '12:00:00'::interval) NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_reason" "text",
    CONSTRAINT "staff_kiosk_operator_sessions_access_role_check" CHECK (("access_role" = ANY (ARRAY['manager'::"text", 'staff'::"text"]))),
    CONSTRAINT "staff_kiosk_operator_sessions_token_hash_check" CHECK (("length"("token_hash") = 64))
);


ALTER TABLE "private"."staff_kiosk_operator_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."staff_kiosk_pin_attempts" (
    "auth_user_id" "uuid" NOT NULL,
    "user_agent_hash" "text" NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_kiosk_pin_attempts_failed_attempts_check" CHECK (("failed_attempts" >= 0)),
    CONSTRAINT "staff_kiosk_pin_attempts_user_agent_hash_check" CHECK (("length"("user_agent_hash") = 64))
);


ALTER TABLE "private"."staff_kiosk_pin_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."staff_kiosk_pin_credentials" (
    "profile_id" "uuid" NOT NULL,
    "pin_hash" "text" NOT NULL,
    "access_role" "text" NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "configured_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pin_secret_id" "uuid",
    CONSTRAINT "staff_kiosk_pin_credentials_access_role_check" CHECK (("access_role" = ANY (ARRAY['manager'::"text", 'staff'::"text"]))),
    CONSTRAINT "staff_kiosk_pin_credentials_failed_attempts_check" CHECK (("failed_attempts" >= 0))
);


ALTER TABLE "private"."staff_kiosk_pin_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."venue_upload_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_key" "text" NOT NULL,
    "upload_kind" "text" NOT NULL,
    "reserved_bytes" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "venue_upload_reservations_reserved_bytes_check" CHECK (("reserved_bytes" > 0)),
    CONSTRAINT "venue_upload_reservations_upload_kind_check" CHECK (("upload_kind" = ANY (ARRAY['review'::"text", 'support'::"text"])))
);


ALTER TABLE "private"."venue_upload_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_analytics_events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "event_name" "text" NOT NULL,
    "path" "text" NOT NULL,
    "device_class" "text" NOT NULL,
    "browser_family" "text" NOT NULL,
    "os_family" "text" NOT NULL,
    "viewport_bucket" "text" NOT NULL,
    "referrer_host" "text",
    "acquisition_source" "text",
    "acquisition_medium" "text",
    "acquisition_campaign" "text",
    "duration_seconds" integer,
    "search_surface" "text",
    "search_query_length" smallint,
    "search_result_count" integer,
    CONSTRAINT "app_analytics_events_acquisition_campaign_check" CHECK ((("acquisition_campaign" IS NULL) OR ("char_length"("acquisition_campaign") <= 120))),
    CONSTRAINT "app_analytics_events_acquisition_medium_check" CHECK ((("acquisition_medium" IS NULL) OR ("char_length"("acquisition_medium") <= 80))),
    CONSTRAINT "app_analytics_events_acquisition_source_check" CHECK ((("acquisition_source" IS NULL) OR ("char_length"("acquisition_source") <= 80))),
    CONSTRAINT "app_analytics_events_browser_family_check" CHECK ((("char_length"("browser_family") >= 1) AND ("char_length"("browser_family") <= 40))),
    CONSTRAINT "app_analytics_events_device_class_check" CHECK (("device_class" = ANY (ARRAY['mobile'::"text", 'tablet'::"text", 'desktop'::"text"]))),
    CONSTRAINT "app_analytics_events_duration_seconds_check" CHECK ((("duration_seconds" IS NULL) OR (("duration_seconds" >= 1) AND ("duration_seconds" <= 1800)))),
    CONSTRAINT "app_analytics_events_event_name_check" CHECK (("event_name" = ANY (ARRAY['page_view'::"text", 'engagement'::"text", 'search'::"text"]))),
    CONSTRAINT "app_analytics_events_os_family_check" CHECK ((("char_length"("os_family") >= 1) AND ("char_length"("os_family") <= 40))),
    CONSTRAINT "app_analytics_events_path_check" CHECK ((("char_length"("path") >= 1) AND ("char_length"("path") <= 180))),
    CONSTRAINT "app_analytics_events_referrer_host_check" CHECK ((("referrer_host" IS NULL) OR ("char_length"("referrer_host") <= 120))),
    CONSTRAINT "app_analytics_events_search_query_length_check" CHECK ((("search_query_length" IS NULL) OR (("search_query_length" >= 0) AND ("search_query_length" <= 240)))),
    CONSTRAINT "app_analytics_events_search_result_count_check" CHECK ((("search_result_count" IS NULL) OR (("search_result_count" >= 0) AND ("search_result_count" <= 10000)))),
    CONSTRAINT "app_analytics_events_search_surface_check" CHECK ((("search_surface" IS NULL) OR ("char_length"("search_surface") <= 80))),
    CONSTRAINT "app_analytics_events_viewport_bucket_check" CHECK ((("char_length"("viewport_bucket") >= 1) AND ("char_length"("viewport_bucket") <= 24)))
);


ALTER TABLE "public"."app_analytics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_analytics_events" IS 'First-party player analytics for public app routes. Raw IP addresses, full URLs, search text, and staff activity are excluded from reporting.';



COMMENT ON COLUMN "public"."app_analytics_events"."client_id" IS 'Random browser identifier used for aggregate public-visitor analytics.';



COMMENT ON COLUMN "public"."app_analytics_events"."profile_id" IS 'Authenticated profile when available; reports expose aggregate data only.';



ALTER TABLE "public"."app_analytics_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."app_analytics_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "operator_session_id" "uuid",
    "operator_role" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "arenas_used" integer NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocked_times_arenas_used_check" CHECK ((("arenas_used" >= 1) AND ("arenas_used" <= 2)))
);


ALTER TABLE "public"."blocked_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_name" "text",
    "customer_phone" "text",
    "booking_date" "date",
    "booking_time" "text",
    "players" integer
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_emoji" "text",
    "avatar_initials" "text",
    "avatar_color" "text",
    "profile_motto" "text",
    "avatar_text_color" "text",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "club_members_avatar_text_color_hex" CHECK ((("avatar_text_color" IS NULL) OR ("avatar_text_color" ~ '^#[0-9A-Fa-f]{6}$'::"text"))),
    CONSTRAINT "club_members_profile_motto_length" CHECK ((("profile_motto" IS NULL) OR ("char_length"("profile_motto") <= 20))),
    CONSTRAINT "club_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'moderator'::"text", 'member'::"text"]))),
    CONSTRAINT "club_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "author_display_name" "text",
    "author_avatar_url" "text",
    "author_avatar_emoji" "text",
    "author_avatar_initials" "text",
    "author_avatar_color" "text",
    "author_avatar_text_color" "text",
    "author_profile_motto" "text",
    "message_type" "text" DEFAULT 'public'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "club_messages_body_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 150))),
    CONSTRAINT "club_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['public'::"text", 'admin_private'::"text"])))
);


ALTER TABLE "public"."club_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "member_count" integer DEFAULT 0 NOT NULL,
    "pin_code" "text",
    "motto" "text",
    "banner_url" "text",
    "theme_color" "text" DEFAULT '#3059ff'::"text" NOT NULL,
    "default_language" "text",
    "ranking_criterion" "text" DEFAULT 'totalScore'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clubs_ranking_criterion_check" CHECK (("ranking_criterion" = ANY (ARRAY['totalScore'::"text", 'wins'::"text", 'winRate'::"text", 'accuracy'::"text", 'reliability'::"text", 'projectiles'::"text", 'hits'::"text", 'movement'::"text", 'gamesPlayed'::"text"]))),
    CONSTRAINT "clubs_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "rule_id" "uuid",
    "points_delta" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid",
    "reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_point_transactions_balance_after_check" CHECK (("balance_after" >= 0)),
    CONSTRAINT "loyalty_point_transactions_source_type_check" CHECK (("source_type" = ANY (ARRAY['staff_order'::"text", 'manual_adjustment'::"text", 'ticket_redemption'::"text"])))
);


ALTER TABLE "public"."loyalty_point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_list" (
    "profile_id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "nickname" "text",
    "phone" "text",
    "consented_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_table" "text" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "source_body_hash" "text" NOT NULL,
    "target_language" "text" NOT NULL,
    "source_language" "text",
    "translated_body" "text" NOT NULL,
    "changed" boolean DEFAULT true NOT NULL,
    "model" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "message_translations_message_table_check" CHECK (("message_table" = ANY (ARRAY['session_messages'::"text", 'club_messages'::"text"]))),
    CONSTRAINT "message_translations_target_language_check" CHECK (("target_language" = ANY (ARRAY['en'::"text", 'vi'::"text", 'ko'::"text", 'ja'::"text", 'fr'::"text", 'de'::"text", 'it'::"text"])))
);


ALTER TABLE "public"."message_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_stat_overrides" (
    "profile_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "sessions_joined" integer,
    "games_joined" integer,
    "wins" integer,
    "best_performer_count" integer,
    "total_score" integer,
    "best_score" integer,
    "average_accuracy" double precision,
    "total_projectiles" integer,
    "total_movement_meters" double precision,
    "best_escape_duration_seconds" integer,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_stat_overrides_average_accuracy_check" CHECK ((("average_accuracy" IS NULL) OR (("average_accuracy" >= (0)::double precision) AND ("average_accuracy" <= (100)::double precision)))),
    CONSTRAINT "player_stat_overrides_best_escape_duration_seconds_check" CHECK ((("best_escape_duration_seconds" IS NULL) OR ("best_escape_duration_seconds" > 0))),
    CONSTRAINT "player_stat_overrides_best_performer_count_check" CHECK ((("best_performer_count" IS NULL) OR ("best_performer_count" >= 0))),
    CONSTRAINT "player_stat_overrides_games_joined_check" CHECK ((("games_joined" IS NULL) OR ("games_joined" >= 0))),
    CONSTRAINT "player_stat_overrides_scope_length" CHECK ((("char_length"("scope") >= 1) AND ("char_length"("scope") <= 120))),
    CONSTRAINT "player_stat_overrides_sessions_joined_check" CHECK ((("sessions_joined" IS NULL) OR ("sessions_joined" >= 0))),
    CONSTRAINT "player_stat_overrides_total_movement_meters_check" CHECK ((("total_movement_meters" IS NULL) OR ("total_movement_meters" >= (0)::double precision))),
    CONSTRAINT "player_stat_overrides_total_projectiles_check" CHECK ((("total_projectiles" IS NULL) OR ("total_projectiles" >= 0))),
    CONSTRAINT "player_stat_overrides_wins_check" CHECK ((("wins" IS NULL) OR ("wins" >= 0)))
);


ALTER TABLE "public"."player_stat_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_zalo_handoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    CONSTRAINT "player_zalo_handoffs_consumed_after_creation" CHECK ((("consumed_at" IS NULL) OR ("consumed_at" >= "created_at"))),
    CONSTRAINT "player_zalo_handoffs_expiry_after_creation" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "player_zalo_handoffs_token_hash_format" CHECK (("token_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."player_zalo_handoffs" OWNER TO "postgres";


COMMENT ON TABLE "public"."player_zalo_handoffs" IS 'Server-only, single-use, short-lived handoff tokens used to establish a normal Supabase session.';



COMMENT ON COLUMN "public"."player_zalo_handoffs"."token_hash" IS 'SHA-256 hash of an opaque handoff token. The raw token is never stored.';



CREATE TABLE IF NOT EXISTS "public"."player_zalo_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "zalo_app_user_id" "text" NOT NULL,
    "verified_phone" "text" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_login_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "player_zalo_identities_display_name_length" CHECK ((("display_name" IS NULL) OR ("char_length"("display_name") <= 120))),
    CONSTRAINT "player_zalo_identities_phone_format" CHECK (("verified_phone" ~ '^\+84[0-9]{8,10}$'::"text")),
    CONSTRAINT "player_zalo_identities_zalo_id_length" CHECK ((("char_length"("zalo_app_user_id") >= 1) AND ("char_length"("zalo_app_user_id") <= 255)))
);


ALTER TABLE "public"."player_zalo_identities" OWNER TO "postgres";


COMMENT ON TABLE "public"."player_zalo_identities" IS 'Server-only permanent mapping between a Zalo Mini App user and a VRena player profile.';



COMMENT ON COLUMN "public"."player_zalo_identities"."verified_phone" IS 'Phone number verified by the Zalo one-time phone token and normalized to Vietnamese E.164.';



CREATE TABLE IF NOT EXISTS "public"."pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "day_type" "text" DEFAULT 'any'::"text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "price_per_player_20min" integer NOT NULL,
    "minimum_total_20min" integer DEFAULT 0 NOT NULL,
    "min_players" integer DEFAULT 1 NOT NULL,
    "max_players" integer DEFAULT 16 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_rules_day_type_check" CHECK (("day_type" = ANY (ARRAY['any'::"text", 'weekday'::"text", 'weekend'::"text"])))
);


ALTER TABLE "public"."pricing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_achievement_awards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "achievement_id" "text" NOT NULL,
    "achievement_kind" "text" DEFAULT 'retention'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "note" "text",
    "awarded_by" "uuid",
    "awarded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_by" "uuid",
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_achievement_awards_achievement_kind_check" CHECK (("achievement_kind" = ANY (ARRAY['game'::"text", 'retention'::"text"])))
);


ALTER TABLE "public"."profile_achievement_awards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_achievement_unlock_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "achievement_kind" "text" NOT NULL,
    "achievement_id" "text" NOT NULL,
    "achievement_tier" "text" DEFAULT 'base'::"text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shared_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_achievement_unlock_views_achievement_kind_check" CHECK (("achievement_kind" = ANY (ARRAY['game'::"text", 'retention'::"text"])))
);


ALTER TABLE "public"."profile_achievement_unlock_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "event_key" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "session_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "url" "text" DEFAULT '/'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scheduled_for" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "push_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'no_subscription'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."push_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "disabled_at" timestamp with time zone,
    "fail_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_hash" "text" NOT NULL,
    "action" "text" NOT NULL,
    "window_started_at" timestamp with time zone NOT NULL,
    "reset_at" timestamp with time zone NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "recipient_display_name" "text",
    "recipient_avatar_url" "text",
    "recipient_avatar_emoji" "text",
    "recipient_avatar_initials" "text",
    "recipient_avatar_color" "text",
    "recipient_avatar_text_color" "text",
    "recipient_profile_motto" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."session_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "author_display_name" "text",
    "author_avatar_url" "text",
    "author_avatar_emoji" "text",
    "author_avatar_initials" "text",
    "author_avatar_color" "text",
    "author_avatar_text_color" "text",
    "author_profile_motto" "text",
    "message_type" "text" DEFAULT 'comment'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "moderation_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "moderation_reason" "text",
    "moderation_categories" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "moderation_score" numeric,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "session_messages_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 500))),
    CONSTRAINT "session_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['announcement'::"text", 'comment'::"text"]))),
    CONSTRAINT "session_messages_moderation_status_check" CHECK (("moderation_status" = ANY (ARRAY['approved'::"text", 'pending_review'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."session_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_participant_chapter_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "staff_game_id" "uuid",
    "game_slug" "text" NOT NULL,
    "chapter_number" integer NOT NULL,
    "duration_seconds" integer NOT NULL,
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_participant_chapter_times_chapter_number_check" CHECK ((("chapter_number" >= 1) AND ("chapter_number" <= 50))),
    CONSTRAINT "session_participant_chapter_times_duration_seconds_check" CHECK ((("duration_seconds" > 0) AND ("duration_seconds" <= 86400)))
);


ALTER TABLE "public"."session_participant_chapter_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checked_in" boolean DEFAULT false NOT NULL,
    "payment_status" "text",
    "checked_in_at" timestamp with time zone,
    "score" numeric,
    "placement" integer,
    "accuracy_percent" numeric,
    "projectiles_fired" integer,
    "avatar_emoji" "text",
    "avatar_initials" "text",
    "avatar_color" "text",
    "payment_amount" integer,
    "prize_claimed" boolean DEFAULT false,
    "prize_claimed_at" timestamp with time zone,
    "profile_motto" "text",
    "avatar_text_color" "text",
    "escape_duration_seconds" integer,
    "payment_splits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hits" integer,
    "movement_meters" numeric(10,2),
    CONSTRAINT "session_participants_avatar_text_color_hex" CHECK ((("avatar_text_color" IS NULL) OR ("avatar_text_color" ~ '^#[0-9A-Fa-f]{6}$'::"text"))),
    CONSTRAINT "session_participants_escape_duration_seconds_check" CHECK ((("escape_duration_seconds" IS NULL) OR ("escape_duration_seconds" > 0))),
    CONSTRAINT "session_participants_hits_check" CHECK ((("hits" IS NULL) OR ("hits" >= 0))),
    CONSTRAINT "session_participants_movement_meters_check" CHECK ((("movement_meters" IS NULL) OR ("movement_meters" >= (0)::numeric))),
    CONSTRAINT "session_participants_payment_splits_array_check" CHECK (("jsonb_typeof"("payment_splits") = 'array'::"text")),
    CONSTRAINT "session_participants_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'free'::"text"]))),
    CONSTRAINT "session_participants_placement_check" CHECK ((("placement" >= 1) AND ("placement" <= 3))),
    CONSTRAINT "session_participants_profile_motto_length" CHECK ((("profile_motto" IS NULL) OR ("char_length"("profile_motto") <= 20)))
);


ALTER TABLE "public"."session_participants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."session_participants"."projectiles_fired" IS 'Deprecated compatibility field. Use hits for result-screen imports and staff result entry.';



COMMENT ON COLUMN "public"."session_participants"."hits" IS 'Number of successful hits shown in the VR game results screen.';



COMMENT ON COLUMN "public"."session_participants"."movement_meters" IS 'Movement distance in meters shown in the VR game results screen.';



CREATE TABLE IF NOT EXISTS "public"."session_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "avatar_emoji" "text",
    "avatar_initials" "text",
    "avatar_color" "text",
    "avatar_text_color" "text",
    "profile_motto" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "duration_minutes" integer DEFAULT 20 NOT NULL,
    "max_players" integer NOT NULL,
    "game_options" "text"[] DEFAULT ARRAY['FPS PVP'::"text"] NOT NULL,
    "game_votes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "invite_code" "text",
    "notes" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_private" boolean DEFAULT false,
    "booked_players" integer DEFAULT 0,
    "arena" integer DEFAULT 1,
    "session_type" "text" DEFAULT 'public'::"text",
    "arena_count" integer DEFAULT 1 NOT NULL,
    "estimated_total" integer,
    "currency" "text" DEFAULT 'VND'::"text" NOT NULL,
    "club_id" "uuid",
    "tournament_rounds_per_match" integer,
    "tournament_format" "text" DEFAULT 'pool_to_final'::"text",
    "best_of" integer DEFAULT 1,
    "require_payment" boolean DEFAULT false,
    "qualification_rule" "text" DEFAULT 'top_1'::"text",
    "custom_qualifiers" integer DEFAULT 2,
    "enable_third_place_match" boolean DEFAULT true,
    "first_prize" "text",
    "second_prize" "text",
    "third_prize" "text",
    "tournament_locked" boolean DEFAULT false,
    "rounds_per_match" integer DEFAULT 1,
    "confirmed_game_id" "text",
    "seeded" boolean DEFAULT false NOT NULL,
    "seed_batch" "text",
    "seed_label" "text",
    "seeded_at" timestamp with time zone,
    "booking_type" "text" DEFAULT 'community'::"text" NOT NULL,
    "ticket_type" "text",
    "ticket_player_count" integer,
    "ticket_unit_price" integer,
    "ticket_total_price" integer,
    "ticket_status" "text",
    "ticket_reference" "text",
    "ticket_customer_id" "uuid",
    "challenge_target_id" "uuid",
    "challenge_status" "text",
    "challenge_accepted_at" timestamp with time zone,
    "challenge_declined_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "ticket_discount_rule_id" "uuid",
    "ticket_discount_code" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "venue_key" "text" DEFAULT 'ha-do-centrosa'::"text" NOT NULL,
    CONSTRAINT "sessions_arena_count_check" CHECK (("arena_count" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "sessions_best_of_check" CHECK (("best_of" = ANY (ARRAY[1, 3, 5]))),
    CONSTRAINT "sessions_booking_type_check" CHECK (("booking_type" = ANY (ARRAY['community'::"text", 'ticket'::"text", 'challenge'::"text"]))),
    CONSTRAINT "sessions_challenge_status_check" CHECK ((("challenge_status" IS NULL) OR ("challenge_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'completed'::"text", 'cancelled'::"text"])))),
    CONSTRAINT "sessions_confirmed_game_id_check" CHECK ((("confirmed_game_id" IS NULL) OR ("confirmed_game_id" = ANY (ARRAY['laser-tag'::"text", 'mini-block-towers'::"text", 'office-war'::"text", 'paintball'::"text", 'snow-battle'::"text", 'castle-unspunnen'::"text", 'wild-west'::"text", 'arc-of-the-covenant'::"text", 'joller-house'::"text"])))),
    CONSTRAINT "sessions_max_players_check" CHECK ((("max_players" >= 1) AND (("max_players" <= 16) OR (("max_players" <= 32) AND COALESCE((("booking_type" = 'ticket'::"text") AND ("ticket_type" = 'corporate'::"text")), false))))),
    CONSTRAINT "sessions_qualification_rule_check" CHECK (("qualification_rule" = ANY (ARRAY['top_1'::"text", 'top_2'::"text", 'top_4'::"text", 'custom'::"text"]))),
    CONSTRAINT "sessions_rounds_per_match_check" CHECK ((("rounds_per_match" >= 1) AND ("rounds_per_match" <= 5))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "sessions_ticket_status_check" CHECK ((("ticket_status" IS NULL) OR ("ticket_status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text", 'completed'::"text"])))),
    CONSTRAINT "sessions_ticket_type_check" CHECK ((("ticket_type" IS NULL) OR ("ticket_type" = ANY (ARRAY['individual'::"text", 'birthday'::"text", 'corporate'::"text"])))),
    CONSTRAINT "sessions_tournament_format_check" CHECK (("tournament_format" = ANY (ARRAY['pool_only'::"text", 'pool_to_semifinal'::"text", 'pool_to_final'::"text", 'single_elimination'::"text", 'double_elimination'::"text", 'leaderboard'::"text"]))),
    CONSTRAINT "sessions_tournament_rounds_per_match_check" CHECK ((("tournament_rounds_per_match" IS NULL) OR (("tournament_rounds_per_match" >= 1) AND ("tournament_rounds_per_match" <= 5)))),
    CONSTRAINT "sessions_venue_key_check" CHECK (("venue_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "sessions_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_attendance_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "approved_log_count" integer DEFAULT 0 NOT NULL,
    "approved_by" "uuid" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_attendance_approvals_approved_log_count_check" CHECK (("approved_log_count" >= 0)),
    CONSTRAINT "staff_attendance_approvals_period_order" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "public"."staff_attendance_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_attendance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_profile_id" "uuid" NOT NULL,
    "shift_id" "uuid",
    "work_date" "date" NOT NULL,
    "clock_in_at" timestamp with time zone,
    "clock_out_at" timestamp with time zone,
    "break_minutes" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'present'::"text" NOT NULL,
    "regular_minutes" integer DEFAULT 0 NOT NULL,
    "overtime_minutes" integer DEFAULT 0 NOT NULL,
    "night_minutes" integer DEFAULT 0 NOT NULL,
    "holiday_minutes" integer DEFAULT 0 NOT NULL,
    "manager_note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "clock_in_location_id" "uuid",
    "clock_out_location_id" "uuid",
    "clock_in_distance_meters" integer,
    "clock_out_distance_meters" integer,
    "late_minutes" integer DEFAULT 0 NOT NULL,
    "early_leave_minutes" integer DEFAULT 0 NOT NULL,
    "is_half_day" boolean DEFAULT false NOT NULL,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "staff_attendance_logs_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text"]))),
    CONSTRAINT "staff_attendance_logs_break_minutes_check" CHECK (("break_minutes" >= 0)),
    CONSTRAINT "staff_attendance_logs_clock_in_distance_meters_check" CHECK ((("clock_in_distance_meters" IS NULL) OR ("clock_in_distance_meters" >= 0))),
    CONSTRAINT "staff_attendance_logs_clock_out_distance_meters_check" CHECK ((("clock_out_distance_meters" IS NULL) OR ("clock_out_distance_meters" >= 0))),
    CONSTRAINT "staff_attendance_logs_holiday_minutes_check" CHECK (("holiday_minutes" >= 0)),
    CONSTRAINT "staff_attendance_logs_night_minutes_check" CHECK (("night_minutes" >= 0)),
    CONSTRAINT "staff_attendance_logs_overtime_minutes_check" CHECK (("overtime_minutes" >= 0)),
    CONSTRAINT "staff_attendance_logs_regular_minutes_check" CHECK (("regular_minutes" >= 0)),
    CONSTRAINT "staff_attendance_logs_rule_minutes_check" CHECK ((("late_minutes" >= 0) AND ("early_leave_minutes" >= 0))),
    CONSTRAINT "staff_attendance_logs_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'late'::"text", 'absent'::"text", 'no_show'::"text", 'leave'::"text", 'holiday'::"text"])))
);


ALTER TABLE "public"."staff_attendance_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_attendance_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "location" "text" DEFAULT 'VRena'::"text" NOT NULL,
    "standard_daily_minutes" integer DEFAULT 480 NOT NULL,
    "standard_weekly_minutes" integer DEFAULT 2880 NOT NULL,
    "overtime_monthly_cap_minutes" integer DEFAULT 2400 NOT NULL,
    "overtime_yearly_cap_minutes" integer DEFAULT 12000 NOT NULL,
    "night_start" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    "night_end" time without time zone DEFAULT '06:00:00'::time without time zone NOT NULL,
    "annual_leave_days" numeric(5,2) DEFAULT 12 NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "standard_break_minutes" integer DEFAULT 60 NOT NULL,
    "shift_templates" "jsonb" DEFAULT '[{"id": "opening", "end_time": "13:00", "shift_role": "Office Staff", "start_time": "09:00", "break_minutes": "0"}, {"id": "afternoon", "end_time": "18:00", "shift_role": "Game Master", "start_time": "13:00", "break_minutes": "30"}, {"id": "evening", "end_time": "22:00", "shift_role": "Office Staff", "start_time": "18:00", "break_minutes": "0"}, {"id": "full_day", "end_time": "18:00", "shift_role": "Staff", "start_time": "09:00", "break_minutes": "60"}]'::"jsonb" NOT NULL,
    "half_day_enabled" boolean DEFAULT true NOT NULL,
    "half_day_min_minutes" integer DEFAULT 0 NOT NULL,
    "half_day_max_minutes" integer DEFAULT 270 NOT NULL,
    "count_late_early_on_half_day" boolean DEFAULT false NOT NULL,
    "late_arrival_enabled" boolean DEFAULT true NOT NULL,
    "late_after_minutes" integer DEFAULT 5 NOT NULL,
    "early_leave_enabled" boolean DEFAULT true NOT NULL,
    "early_leave_before_minutes" integer DEFAULT 5 NOT NULL,
    "overtime_before_shift_enabled" boolean DEFAULT false NOT NULL,
    "overtime_before_shift_minutes" integer DEFAULT 10 NOT NULL,
    "overtime_after_shift_enabled" boolean DEFAULT false NOT NULL,
    "overtime_after_shift_minutes" integer DEFAULT 10 NOT NULL,
    "single_clock_for_consecutive_shifts" boolean DEFAULT true NOT NULL,
    "work_week_start" smallint DEFAULT 1 NOT NULL,
    "weekly_rest_days" smallint[] DEFAULT ARRAY[(0)::smallint] NOT NULL,
    CONSTRAINT "staff_attendance_settings_annual_leave_days_check" CHECK (("annual_leave_days" >= (0)::numeric)),
    CONSTRAINT "staff_attendance_settings_clock_rule_minutes_check" CHECK (((("late_after_minutes" >= 0) AND ("late_after_minutes" <= 240)) AND (("early_leave_before_minutes" >= 0) AND ("early_leave_before_minutes" <= 240)) AND (("overtime_before_shift_minutes" >= 0) AND ("overtime_before_shift_minutes" <= 240)) AND (("overtime_after_shift_minutes" >= 0) AND ("overtime_after_shift_minutes" <= 240)))),
    CONSTRAINT "staff_attendance_settings_half_day_range_check" CHECK ((("half_day_min_minutes" >= 0) AND ("half_day_max_minutes" >= "half_day_min_minutes") AND ("half_day_max_minutes" <= 1440))),
    CONSTRAINT "staff_attendance_settings_overtime_monthly_cap_minutes_check" CHECK (("overtime_monthly_cap_minutes" >= 0)),
    CONSTRAINT "staff_attendance_settings_overtime_yearly_cap_minutes_check" CHECK (("overtime_yearly_cap_minutes" >= 0)),
    CONSTRAINT "staff_attendance_settings_standard_break_minutes_check" CHECK (("standard_break_minutes" >= 0)),
    CONSTRAINT "staff_attendance_settings_standard_daily_minutes_check" CHECK (("standard_daily_minutes" >= 0)),
    CONSTRAINT "staff_attendance_settings_standard_weekly_minutes_check" CHECK (("standard_weekly_minutes" >= 0)),
    CONSTRAINT "staff_attendance_settings_weekly_rest_days_check" CHECK (("weekly_rest_days" <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint])),
    CONSTRAINT "staff_attendance_settings_work_week_start_check" CHECK ((("work_week_start" >= 0) AND ("work_week_start" <= 6)))
);


ALTER TABLE "public"."staff_attendance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_check_in_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "radius_meters" integer DEFAULT 30 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_check_in_locations_address_length" CHECK ((("address" IS NULL) OR ("length"("address") <= 500))),
    CONSTRAINT "staff_check_in_locations_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "staff_check_in_locations_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision))),
    CONSTRAINT "staff_check_in_locations_name_length" CHECK ((("length"("btrim"("name")) >= 1) AND ("length"("btrim"("name")) <= 120))),
    CONSTRAINT "staff_check_in_locations_radius_meters_check" CHECK ((("radius_meters" >= 10) AND ("radius_meters" <= 500)))
);


ALTER TABLE "public"."staff_check_in_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_cost_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "cost_location" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "public"."current_staff_actor_profile_id"(),
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    CONSTRAINT "staff_cost_assignments_check" CHECK ((("end_date" >= "start_date") AND (("end_date" - "start_date") <= 365))),
    CONSTRAINT "staff_cost_assignments_cost_location_check" CHECK (("cost_location" = ANY (ARRAY['HaDo'::"text", 'CS'::"text", 'VRE'::"text"]))),
    CONSTRAINT "staff_cost_assignments_reason_check" CHECK ((("length"("btrim"("reason")) >= 1) AND ("length"("btrim"("reason")) <= 500)))
);


ALTER TABLE "public"."staff_cost_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_cost_assignments" IS 'Dated shop cost attribution. Inclusive dates, no overlapping active assignments. Does not change employment home location or payroll amounts.';



CREATE TABLE IF NOT EXISTS "public"."staff_discount_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "value" numeric(10,2) DEFAULT 0 NOT NULL,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "max_uses" integer,
    "used_count" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "game_id" "uuid",
    "min_players" integer,
    "max_players" integer,
    "day_scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "time_start" time without time zone,
    "time_end" time without time zone,
    "ticket_type" "text" DEFAULT 'all'::"text" NOT NULL,
    "min_order_total" integer DEFAULT 0 NOT NULL,
    "max_discount_amount" integer,
    "per_customer_limit" integer,
    "price_rule_id" "uuid",
    CONSTRAINT "staff_discount_rules_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "staff_discount_rules_day_scope_check" CHECK (("day_scope" = ANY (ARRAY['all'::"text", 'weekday'::"text", 'weekend'::"text", 'mon'::"text", 'tue'::"text", 'wed'::"text", 'thu'::"text", 'fri'::"text", 'sat'::"text", 'sun'::"text"]))),
    CONSTRAINT "staff_discount_rules_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed_amount'::"text", 'free_ticket'::"text", 'birthday'::"text", 'resident'::"text", 'group'::"text"]))),
    CONSTRAINT "staff_discount_rules_max_discount_amount_check" CHECK ((("max_discount_amount" IS NULL) OR ("max_discount_amount" >= 0))),
    CONSTRAINT "staff_discount_rules_max_players_check" CHECK ((("max_players" IS NULL) OR ("max_players" > 0))),
    CONSTRAINT "staff_discount_rules_max_uses_check" CHECK ((("max_uses" IS NULL) OR ("max_uses" > 0))),
    CONSTRAINT "staff_discount_rules_min_order_total_check" CHECK (("min_order_total" >= 0)),
    CONSTRAINT "staff_discount_rules_min_players_check" CHECK ((("min_players" IS NULL) OR ("min_players" > 0))),
    CONSTRAINT "staff_discount_rules_per_customer_limit_check" CHECK ((("per_customer_limit" IS NULL) OR ("per_customer_limit" > 0))),
    CONSTRAINT "staff_discount_rules_ticket_type_check" CHECK (("ticket_type" = ANY (ARRAY['all'::"text", 'individual'::"text", 'birthday'::"text", 'corporate'::"text"]))),
    CONSTRAINT "staff_discount_rules_used_count_check" CHECK (("used_count" >= 0)),
    CONSTRAINT "staff_discount_rules_value_check" CHECK (("value" >= (0)::numeric))
);


ALTER TABLE "public"."staff_discount_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_employee_profiles" (
    "profile_id" "uuid" NOT NULL,
    "employee_code" "text",
    "legal_name" "text",
    "personal_phone" "text",
    "personal_email" "text",
    "job_title" "text",
    "employment_type" "text" DEFAULT 'part_time'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "base_salary_vnd" integer DEFAULT 0 NOT NULL,
    "hourly_rate_vnd" integer DEFAULT 0 NOT NULL,
    "bank_name" "text",
    "bank_account_number" "text",
    "tax_code" "text",
    "social_insurance_number" "text",
    "emergency_contact" "text",
    "payroll_note" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "attendance_number" "text",
    "national_id" "text",
    "date_of_birth" "date",
    "gender" "text",
    "address" "text",
    "department" "text",
    "main_work_location" "text",
    "payroll_location" "text",
    "contract_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "contract_type" "text",
    "contract_start_date" "date",
    "contract_end_date" "date",
    "profile_photo_path" "text",
    "cv_document_path" "text",
    "lunch_allowance_vnd" integer DEFAULT 0 NOT NULL,
    "rest_period_minutes" integer,
    "overtime_rate_multiplier" numeric(5,2),
    "night_rate_multiplier" numeric(5,2),
    "holiday_rate_multiplier" numeric(5,2),
    "employee_contribution_rate" numeric(5,2),
    "employer_contribution_rate" numeric(5,2),
    "pit_withholding_rate" numeric(5,2),
    "dependents_count" integer DEFAULT 0 NOT NULL,
    "kiosk_access_role" "text",
    "kiosk_pin_configured_at" timestamp with time zone,
    "probation_payroll_type" "text" DEFAULT 'hourly'::"text" NOT NULL,
    "labor_payroll_type" "text" DEFAULT 'hourly'::"text" NOT NULL,
    "probation_salary_percentage" numeric(5,2) DEFAULT 85 NOT NULL,
    "probation_start_date" "date",
    "probation_end_date" "date",
    "labor_start_date" "date",
    "labor_end_date" "date",
    "emergency_contact_name" "text",
    "emergency_contact_relationship" "text",
    "emergency_contact_phone" "text",
    "social_insurance_enrolled" boolean DEFAULT false NOT NULL,
    "social_insurance_salary_vnd" integer DEFAULT 0 NOT NULL,
    "google_drive_folder_url" "text",
    "probation_bonus_percentage" numeric(5,2) DEFAULT 100 NOT NULL,
    "monthly_bonus_vnd" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "staff_employee_home_department_check" CHECK ((("deleted_at" IS NOT NULL) OR ((("department" IS DISTINCT FROM 'Office'::"text") OR (NOT ("main_work_location" IS DISTINCT FROM 'VRE'::"text"))) AND (("department" IS DISTINCT FROM 'GC'::"text") OR (NOT ("main_work_location" IS DISTINCT FROM 'HaDo'::"text")))))),
    CONSTRAINT "staff_employee_profiles_base_salary_vnd_check" CHECK (("base_salary_vnd" >= 0)),
    CONSTRAINT "staff_employee_profiles_contract_status_check" CHECK (("contract_status" = ANY (ARRAY['active'::"text", 'probation'::"text", 'suspended'::"text", 'ended'::"text", 'draft'::"text"]))),
    CONSTRAINT "staff_employee_profiles_dependents_count_check" CHECK (("dependents_count" >= 0)),
    CONSTRAINT "staff_employee_profiles_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['full_time'::"text", 'part_time'::"text", 'contractor'::"text", 'intern'::"text", 'probation_full_time'::"text", 'probation_part_time'::"text"]))),
    CONSTRAINT "staff_employee_profiles_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['female'::"text", 'male'::"text", 'non_binary'::"text", 'prefer_not_to_say'::"text", 'other'::"text"])))),
    CONSTRAINT "staff_employee_profiles_google_drive_url_check" CHECK ((("google_drive_folder_url" IS NULL) OR ("google_drive_folder_url" ~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+'::"text"))),
    CONSTRAINT "staff_employee_profiles_hourly_rate_vnd_check" CHECK (("hourly_rate_vnd" >= 0)),
    CONSTRAINT "staff_employee_profiles_kiosk_access_role_check" CHECK ((("kiosk_access_role" IS NULL) OR ("kiosk_access_role" = ANY (ARRAY['manager'::"text", 'staff'::"text"])))),
    CONSTRAINT "staff_employee_profiles_labor_dates_check" CHECK ((("labor_end_date" IS NULL) OR ("labor_start_date" IS NULL) OR ("labor_end_date" >= "labor_start_date"))),
    CONSTRAINT "staff_employee_profiles_labor_payroll_type_check" CHECK (("labor_payroll_type" = ANY (ARRAY['hourly'::"text", 'monthly'::"text", 'manager'::"text"]))),
    CONSTRAINT "staff_employee_profiles_lunch_allowance_check" CHECK (("lunch_allowance_vnd" >= 0)),
    CONSTRAINT "staff_employee_profiles_monthly_bonus_check" CHECK (("monthly_bonus_vnd" >= 0)),
    CONSTRAINT "staff_employee_profiles_probation_bonus_percentage_check" CHECK (("probation_bonus_percentage" = ANY (ARRAY[(85)::numeric, (100)::numeric]))),
    CONSTRAINT "staff_employee_profiles_probation_dates_check" CHECK ((("probation_end_date" IS NULL) OR ("probation_start_date" IS NULL) OR ("probation_end_date" >= "probation_start_date"))),
    CONSTRAINT "staff_employee_profiles_probation_payroll_type_check" CHECK (("probation_payroll_type" = ANY (ARRAY['hourly'::"text", 'monthly'::"text", 'manager'::"text"]))),
    CONSTRAINT "staff_employee_profiles_probation_salary_percentage_check" CHECK (("probation_salary_percentage" = ANY (ARRAY[(85)::numeric, (100)::numeric]))),
    CONSTRAINT "staff_employee_profiles_rate_overrides_check" CHECK (((("overtime_rate_multiplier" IS NULL) OR ("overtime_rate_multiplier" >= (0)::numeric)) AND (("night_rate_multiplier" IS NULL) OR ("night_rate_multiplier" >= (0)::numeric)) AND (("holiday_rate_multiplier" IS NULL) OR ("holiday_rate_multiplier" >= (0)::numeric)) AND (("employee_contribution_rate" IS NULL) OR ("employee_contribution_rate" >= (0)::numeric)) AND (("employer_contribution_rate" IS NULL) OR ("employer_contribution_rate" >= (0)::numeric)) AND (("pit_withholding_rate" IS NULL) OR ("pit_withholding_rate" >= (0)::numeric)))),
    CONSTRAINT "staff_employee_profiles_rest_period_check" CHECK ((("rest_period_minutes" IS NULL) OR ("rest_period_minutes" >= 0))),
    CONSTRAINT "staff_employee_profiles_social_insurance_salary_check" CHECK (("social_insurance_salary_vnd" >= 0))
);


ALTER TABLE "public"."staff_employee_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff_employee_profiles"."profile_id" IS 'Independent employee UUID. This is not a player profile ID or auth user ID.';



COMMENT ON COLUMN "public"."staff_employee_profiles"."overtime_rate_multiplier" IS 'Deprecated employee override. Payroll uses staff_hr_settings.';



COMMENT ON COLUMN "public"."staff_employee_profiles"."employee_contribution_rate" IS 'Deprecated employee override. Payroll uses staff_hr_settings and employee eligibility.';



COMMENT ON COLUMN "public"."staff_employee_profiles"."probation_salary_percentage" IS 'Probation percentage from the authoritative HR Employee Master. Labor salary is the 100% base salary.';



COMMENT ON COLUMN "public"."staff_employee_profiles"."google_drive_folder_url" IS 'Editable link to the employee HR folder in Google Drive.';



COMMENT ON COLUMN "public"."staff_employee_profiles"."probation_bonus_percentage" IS 'Percentage of approved bonus and commission amounts paid while the payroll period is inside the employee probation dates. Existing employees default to 100 percent.';



COMMENT ON COLUMN "public"."staff_employee_profiles"."monthly_bonus_vnd" IS 'Recurring monthly bonus included in payroll. The probation bonus percentage is applied while the employee is in probation.';



CREATE TABLE IF NOT EXISTS "public"."staff_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "game_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "duration_minutes" integer DEFAULT 20 NOT NULL,
    "max_players_per_arena" integer DEFAULT 4 NOT NULL,
    "number_of_rounds" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "difficulty" "text",
    "image_url" "text",
    "active" boolean DEFAULT true NOT NULL,
    "available_arena_ids" "text"[] DEFAULT ARRAY['arena-1'::"text"] NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guide_language" "text" DEFAULT 'en'::"text" NOT NULL,
    "guide_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "guide_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "guide_tips" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "audience" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "escape_chapter_count" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "staff_games_audience_allowed" CHECK (("audience" <@ ARRAY['family_friendly'::"text", 'scary'::"text", 'fun'::"text", 'quest'::"text", 'teamwork'::"text", 'beginner_friendly'::"text", 'competitive'::"text"])),
    CONSTRAINT "staff_games_duration_minutes_check" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 240))),
    CONSTRAINT "staff_games_escape_chapter_count_check" CHECK ((("escape_chapter_count" >= 1) AND ("escape_chapter_count" <= 50))),
    CONSTRAINT "staff_games_game_type_check" CHECK (("game_type" = ANY (ARRAY['shooting'::"text", 'escape'::"text", 'tournament'::"text", 'other'::"text"]))),
    CONSTRAINT "staff_games_guide_language_allowed" CHECK (("guide_language" = ANY (ARRAY['en'::"text", 'vi'::"text", 'ko'::"text", 'ja'::"text", 'fr'::"text", 'de'::"text", 'it'::"text"]))),
    CONSTRAINT "staff_games_guide_rules_object" CHECK (("jsonb_typeof"("guide_rules") = 'object'::"text")),
    CONSTRAINT "staff_games_guide_summary_object" CHECK (("jsonb_typeof"("guide_summary") = 'object'::"text")),
    CONSTRAINT "staff_games_guide_tips_object" CHECK (("jsonb_typeof"("guide_tips") = 'object'::"text")),
    CONSTRAINT "staff_games_max_players_per_arena_check" CHECK ((("max_players_per_arena" > 0) AND ("max_players_per_arena" <= 32))),
    CONSTRAINT "staff_games_number_of_rounds_check" CHECK ((("number_of_rounds" > 0) AND ("number_of_rounds" <= 20)))
);


ALTER TABLE "public"."staff_games" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff_games"."guide_language" IS 'Default/fallback language for customer-facing game guide text.';



COMMENT ON COLUMN "public"."staff_games"."guide_summary" IS 'Customer-facing game guide summary, stored as a JSON object keyed by language code.';



COMMENT ON COLUMN "public"."staff_games"."guide_rules" IS 'Customer-facing GamePlay/rules text, stored as a JSON object keyed by language code.';



COMMENT ON COLUMN "public"."staff_games"."guide_tips" IS 'Customer-facing game guide tips, stored as a JSON object keyed by language code.';



COMMENT ON COLUMN "public"."staff_games"."audience" IS 'Customer-facing audience tags for staff-managed games. Allowed values: family_friendly, scary, fun, quest, teamwork, beginner_friendly, competitive.';



COMMENT ON COLUMN "public"."staff_games"."escape_chapter_count" IS 'Number of playable chapters for Escape games; used for per-chapter speedrun history.';



CREATE TABLE IF NOT EXISTS "public"."staff_hr_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "payroll_run_id" "uuid",
    "adjustment_type" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "amount_vnd" integer NOT NULL,
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requires_validation" boolean DEFAULT true NOT NULL,
    "validated_by" "uuid",
    "validated_at" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "taxable" boolean DEFAULT true NOT NULL,
    "social_insurance_subject" boolean DEFAULT false NOT NULL,
    CONSTRAINT "staff_hr_adjustments_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['bonus'::"text", 'commission'::"text", 'allowance'::"text", 'lunch_allowance'::"text", 'deduction'::"text", 'advance'::"text", 'debt'::"text", 'debt_repayment'::"text"]))),
    CONSTRAINT "staff_hr_adjustments_amount_vnd_check" CHECK (("amount_vnd" >= 0)),
    CONSTRAINT "staff_hr_adjustments_period_order" CHECK ((("period_start" IS NULL) OR ("period_end" IS NULL) OR ("period_end" >= "period_start"))),
    CONSTRAINT "staff_hr_adjustments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."staff_hr_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_hr_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'staff-hr-documents'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" integer DEFAULT 0 NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_hr_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['profile_photo'::"text", 'cv'::"text", 'contract'::"text", 'national_id'::"text", 'payslip'::"text", 'other'::"text"]))),
    CONSTRAINT "staff_hr_documents_size_bytes_check" CHECK (("size_bytes" >= 0))
);


ALTER TABLE "public"."staff_hr_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_hr_policy_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version" "text" NOT NULL,
    "effective_from" "date" NOT NULL,
    "policy_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "settings" "jsonb" NOT NULL,
    "legal_source_url" "text",
    "legal_reviewed_on" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_hr_policy_versions_legal_source_url_check" CHECK ((("legal_source_url" IS NULL) OR ("legal_source_url" ~ '^https://'::"text"))),
    CONSTRAINT "staff_hr_policy_versions_policy_status_check" CHECK (("policy_status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"]))),
    CONSTRAINT "staff_hr_policy_versions_policy_version_check" CHECK (("length"(TRIM(BOTH FROM "policy_version")) > 0)),
    CONSTRAINT "staff_hr_policy_versions_settings_check" CHECK (("jsonb_typeof"("settings") = 'object'::"text"))
);


ALTER TABLE "public"."staff_hr_policy_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_hr_policy_versions" IS 'Effective-dated, immutable-at-period payroll policy snapshots. Historical approved payroll remains unchanged.';



CREATE TABLE IF NOT EXISTS "public"."staff_hr_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "currency" "text" DEFAULT 'VND'::"text" NOT NULL,
    "standard_monthly_days" numeric(5,2) DEFAULT 26 NOT NULL,
    "standard_monthly_hours" numeric(6,2) DEFAULT 169 NOT NULL,
    "rest_period_minutes" integer DEFAULT 660 NOT NULL,
    "normal_overtime_multiplier" numeric(5,2) DEFAULT 1.50 NOT NULL,
    "night_overtime_multiplier" numeric(5,2) DEFAULT 2.00 NOT NULL,
    "holiday_overtime_multiplier" numeric(5,2) DEFAULT 3.00 NOT NULL,
    "lunch_allowance_vnd" integer DEFAULT 35000 NOT NULL,
    "annual_leave_days" numeric(5,2) DEFAULT 12 NOT NULL,
    "employee_contribution_rate" numeric(5,2) DEFAULT 10.50 NOT NULL,
    "employer_contribution_rate" numeric(5,2) DEFAULT 21.50 NOT NULL,
    "pit_withholding_rate" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "payslip_note" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pay_period_start_day" integer DEFAULT 1 NOT NULL,
    "auto_create_payroll_runs" boolean DEFAULT false NOT NULL,
    "auto_update_payroll_daily" boolean DEFAULT false NOT NULL,
    "personal_income_tax_enabled" boolean DEFAULT true NOT NULL,
    "social_insurance_enabled" boolean DEFAULT true NOT NULL,
    "last_auto_payroll_sync_on" "date",
    "policy_version" "text" DEFAULT 'VN-2026.1'::"text" NOT NULL,
    "effective_from" "date" DEFAULT '2026-01-01'::"date" NOT NULL,
    "policy_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "legal_source_url" "text",
    "legal_reviewed_on" "date",
    "personal_deduction_vnd" integer DEFAULT 15500000 NOT NULL,
    "dependent_deduction_vnd" integer DEFAULT 6200000 NOT NULL,
    "short_term_pit_rate" numeric(5,2) DEFAULT 10 NOT NULL,
    "pit_brackets" "jsonb" DEFAULT '[{"rate": 5, "up_to": 10000000}, {"rate": 10, "up_to": 30000000}, {"rate": 20, "up_to": 60000000}, {"rate": 30, "up_to": 100000000}, {"rate": 35, "up_to": null}]'::"jsonb" NOT NULL,
    "employee_social_insurance_rate" numeric(5,2) DEFAULT 8 NOT NULL,
    "employee_health_insurance_rate" numeric(5,2) DEFAULT 1.5 NOT NULL,
    "employee_unemployment_insurance_rate" numeric(5,2) DEFAULT 1 NOT NULL,
    "employer_social_insurance_rate" numeric(5,2) DEFAULT 17.5 NOT NULL,
    "employer_health_insurance_rate" numeric(5,2) DEFAULT 3 NOT NULL,
    "employer_unemployment_insurance_rate" numeric(5,2) DEFAULT 1 NOT NULL,
    "employer_trade_union_rate" numeric(5,2) DEFAULT 2 NOT NULL,
    "night_work_bonus_rate" numeric(5,2) DEFAULT 30 NOT NULL,
    "night_overtime_extra_rate" numeric(5,2) DEFAULT 20 NOT NULL,
    "leave_accrual_days_per_month" numeric(5,2) DEFAULT 1 NOT NULL,
    "leave_qualifying_worked_days" integer DEFAULT 16 NOT NULL,
    "leave_join_cutoff_day" integer DEFAULT 15 NOT NULL,
    "leave_exit_cutoff_day" integer DEFAULT 17 NOT NULL,
    "leave_carry_forward_month" integer DEFAULT 3 NOT NULL,
    "leave_carry_forward_day" integer DEFAULT 31 NOT NULL,
    CONSTRAINT "staff_hr_settings_annual_leave_days_check" CHECK (("annual_leave_days" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_employee_contribution_rate_check" CHECK (("employee_contribution_rate" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_employer_contribution_rate_check" CHECK (("employer_contribution_rate" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_holiday_overtime_multiplier_check" CHECK (("holiday_overtime_multiplier" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_leave_days_check" CHECK (((("leave_qualifying_worked_days" >= 0) AND ("leave_qualifying_worked_days" <= 31)) AND (("leave_join_cutoff_day" >= 1) AND ("leave_join_cutoff_day" <= 31)) AND (("leave_exit_cutoff_day" >= 1) AND ("leave_exit_cutoff_day" <= 31)) AND (("leave_carry_forward_month" >= 1) AND ("leave_carry_forward_month" <= 12)) AND (("leave_carry_forward_day" >= 1) AND ("leave_carry_forward_day" <= 31)))),
    CONSTRAINT "staff_hr_settings_legal_source_url_check" CHECK ((("legal_source_url" IS NULL) OR ("legal_source_url" ~ '^https://'::"text"))),
    CONSTRAINT "staff_hr_settings_lunch_allowance_vnd_check" CHECK (("lunch_allowance_vnd" >= 0)),
    CONSTRAINT "staff_hr_settings_night_overtime_multiplier_check" CHECK (("night_overtime_multiplier" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_normal_overtime_multiplier_check" CHECK (("normal_overtime_multiplier" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_pay_period_start_day_check" CHECK ((("pay_period_start_day" >= 1) AND ("pay_period_start_day" <= 28))),
    CONSTRAINT "staff_hr_settings_pit_brackets_check" CHECK ((("jsonb_typeof"("pit_brackets") = 'array'::"text") AND ("jsonb_array_length"("pit_brackets") > 0))),
    CONSTRAINT "staff_hr_settings_pit_withholding_rate_check" CHECK (("pit_withholding_rate" >= (0)::numeric)),
    CONSTRAINT "staff_hr_settings_policy_status_check" CHECK (("policy_status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"]))),
    CONSTRAINT "staff_hr_settings_policy_version_check" CHECK (("length"(TRIM(BOTH FROM "policy_version")) > 0)),
    CONSTRAINT "staff_hr_settings_rest_period_minutes_check" CHECK (("rest_period_minutes" >= 0)),
    CONSTRAINT "staff_hr_settings_standard_monthly_days_check" CHECK (("standard_monthly_days" > (0)::numeric)),
    CONSTRAINT "staff_hr_settings_standard_monthly_hours_check" CHECK (("standard_monthly_hours" > (0)::numeric))
);


ALTER TABLE "public"."staff_hr_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff_hr_settings"."pit_brackets" IS 'Ordered monthly progressive PIT brackets. Each object contains up_to VND or null and a percentage rate.';



CREATE TABLE IF NOT EXISTS "public"."staff_leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_profile_id" "uuid" NOT NULL,
    "leave_type" "text" DEFAULT 'annual'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "hours" numeric(6,2) DEFAULT 8 NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "requested_by" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_leave_requests_date_order" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "staff_leave_requests_hours_check" CHECK (("hours" >= (0)::numeric)),
    CONSTRAINT "staff_leave_requests_leave_type_check" CHECK (("leave_type" = ANY (ARRAY['annual'::"text", 'sick'::"text", 'unpaid'::"text", 'personal'::"text", 'public_holiday'::"text"]))),
    CONSTRAINT "staff_leave_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."staff_leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_loyalty_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_name" "text" NOT NULL,
    "game_id" "uuid",
    "calculation_type" "text" DEFAULT 'per_vnd_spent'::"text" NOT NULL,
    "points_value" numeric(10,2) DEFAULT 1 NOT NULL,
    "spend_amount" integer DEFAULT 100000 NOT NULL,
    "min_order_total" integer DEFAULT 0 NOT NULL,
    "point_expiry_days" integer,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "redeem_value_vnd_per_point" integer DEFAULT 0 NOT NULL,
    "earn_trigger" "text" DEFAULT 'session_payment_confirmed'::"text" NOT NULL,
    "rounding_rule" "text" DEFAULT 'floor_whole_points'::"text" NOT NULL,
    CONSTRAINT "staff_loyalty_rules_calculation_type_check" CHECK (("calculation_type" = ANY (ARRAY['per_vnd_spent'::"text", 'per_booking'::"text", 'per_player'::"text", 'per_visit'::"text"]))),
    CONSTRAINT "staff_loyalty_rules_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "staff_loyalty_rules_check1" CHECK ((("calculation_type" <> 'per_vnd_spent'::"text") OR ("spend_amount" > 0))),
    CONSTRAINT "staff_loyalty_rules_earn_trigger_check" CHECK (("earn_trigger" = 'session_payment_confirmed'::"text")),
    CONSTRAINT "staff_loyalty_rules_min_order_total_check" CHECK (("min_order_total" >= 0)),
    CONSTRAINT "staff_loyalty_rules_point_expiry_days_check" CHECK ((("point_expiry_days" IS NULL) OR (("point_expiry_days" > 0) AND ("point_expiry_days" <= 3650)))),
    CONSTRAINT "staff_loyalty_rules_points_value_check" CHECK (("points_value" >= (0)::numeric)),
    CONSTRAINT "staff_loyalty_rules_redeem_value_vnd_per_point_check" CHECK (("redeem_value_vnd_per_point" >= 0)),
    CONSTRAINT "staff_loyalty_rules_rounding_rule_check" CHECK (("rounding_rule" = 'floor_whole_points'::"text")),
    CONSTRAINT "staff_loyalty_rules_spend_amount_check" CHECK (("spend_amount" >= 0))
);


ALTER TABLE "public"."staff_loyalty_rules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staff_order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_order_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_order_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_method" "text" NOT NULL,
    "amount" integer NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_order_payments_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "staff_order_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text"])))
);


ALTER TABLE "public"."staff_order_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_id" "uuid",
    "customer_name" "text",
    "customer_phone" "text",
    "customer_email" "text",
    "game_id" "uuid",
    "session_id" "uuid",
    "booking_date" "date" NOT NULL,
    "booking_time" time without time zone NOT NULL,
    "players_count" integer NOT NULL,
    "arena_id" "text",
    "subtotal" integer DEFAULT 0 NOT NULL,
    "discount_rule_id" "uuid",
    "discount_code" "text",
    "discount_total" integer DEFAULT 0 NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "payment_method" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "order_status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invoice_required" boolean DEFAULT false NOT NULL,
    "company_name" "text",
    "tax_code" "text",
    "invoice_email" "text",
    "invoice_address" "text",
    "invoice_status" "text" DEFAULT 'not_requested'::"text" NOT NULL,
    "external_invoice_id" "text",
    "internal_note" "text",
    CONSTRAINT "staff_orders_discount_total_check" CHECK (("discount_total" >= 0)),
    CONSTRAINT "staff_orders_invoice_status_check" CHECK (("invoice_status" = ANY (ARRAY['not_requested'::"text", 'pending'::"text", 'issued'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "staff_orders_order_status_check" CHECK (("order_status" = ANY (ARRAY['draft'::"text", 'confirmed'::"text", 'paid'::"text", 'partially_paid'::"text", 'cancelled'::"text", 'refunded'::"text", 'no_show'::"text", 'completed'::"text"]))),
    CONSTRAINT "staff_orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'split'::"text", 'momo_manual'::"text", 'card_manual'::"text", 'voucher'::"text", 'free_ticket'::"text", 'unpaid'::"text"]))),
    CONSTRAINT "staff_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'partially_paid'::"text", 'paid'::"text", 'refunded'::"text"]))),
    CONSTRAINT "staff_orders_players_count_check" CHECK ((("players_count" > 0) AND ("players_count" <= 64))),
    CONSTRAINT "staff_orders_subtotal_check" CHECK (("subtotal" >= 0)),
    CONSTRAINT "staff_orders_total_check" CHECK (("total" >= 0))
);


ALTER TABLE "public"."staff_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_payroll_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payroll_run_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "payslip_number" "text",
    "worked_minutes" integer DEFAULT 0 NOT NULL,
    "regular_minutes" integer DEFAULT 0 NOT NULL,
    "overtime_minutes" integer DEFAULT 0 NOT NULL,
    "night_minutes" integer DEFAULT 0 NOT NULL,
    "holiday_minutes" integer DEFAULT 0 NOT NULL,
    "paid_leave_hours" numeric(7,2) DEFAULT 0 NOT NULL,
    "rest_warning_count" integer DEFAULT 0 NOT NULL,
    "base_salary_vnd" integer DEFAULT 0 NOT NULL,
    "overtime_pay_vnd" integer DEFAULT 0 NOT NULL,
    "allowances_vnd" integer DEFAULT 0 NOT NULL,
    "bonuses_vnd" integer DEFAULT 0 NOT NULL,
    "advances_vnd" integer DEFAULT 0 NOT NULL,
    "deductions_vnd" integer DEFAULT 0 NOT NULL,
    "employee_contributions_vnd" integer DEFAULT 0 NOT NULL,
    "employer_contributions_vnd" integer DEFAULT 0 NOT NULL,
    "pit_withholding_vnd" integer DEFAULT 0 NOT NULL,
    "gross_income_vnd" integer DEFAULT 0 NOT NULL,
    "net_income_vnd" integer DEFAULT 0 NOT NULL,
    "company_cost_vnd" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "payslip_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_payroll_items_advances_vnd_check" CHECK (("advances_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_allowances_vnd_check" CHECK (("allowances_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_base_salary_vnd_check" CHECK (("base_salary_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_bonuses_vnd_check" CHECK (("bonuses_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_company_cost_vnd_check" CHECK (("company_cost_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_deductions_vnd_check" CHECK (("deductions_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_employee_contributions_vnd_check" CHECK (("employee_contributions_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_employer_contributions_vnd_check" CHECK (("employer_contributions_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_gross_income_vnd_check" CHECK (("gross_income_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_holiday_minutes_check" CHECK (("holiday_minutes" >= 0)),
    CONSTRAINT "staff_payroll_items_net_income_vnd_check" CHECK (("net_income_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_night_minutes_check" CHECK (("night_minutes" >= 0)),
    CONSTRAINT "staff_payroll_items_overtime_minutes_check" CHECK (("overtime_minutes" >= 0)),
    CONSTRAINT "staff_payroll_items_overtime_pay_vnd_check" CHECK (("overtime_pay_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_paid_leave_hours_check" CHECK (("paid_leave_hours" >= (0)::numeric)),
    CONSTRAINT "staff_payroll_items_pit_withholding_vnd_check" CHECK (("pit_withholding_vnd" >= 0)),
    CONSTRAINT "staff_payroll_items_regular_minutes_check" CHECK (("regular_minutes" >= 0)),
    CONSTRAINT "staff_payroll_items_rest_warning_count_check" CHECK (("rest_warning_count" >= 0)),
    CONSTRAINT "staff_payroll_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "staff_payroll_items_worked_minutes_check" CHECK (("worked_minutes" >= 0))
);


ALTER TABLE "public"."staff_payroll_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_payroll_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "pay_cycle" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_gross_vnd" integer DEFAULT 0 NOT NULL,
    "total_net_vnd" integer DEFAULT 0 NOT NULL,
    "total_company_cost_vnd" integer DEFAULT 0 NOT NULL,
    "generated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_payroll_runs_date_order" CHECK (("period_end" >= "period_start")),
    CONSTRAINT "staff_payroll_runs_pay_cycle_check" CHECK (("pay_cycle" = ANY (ARRAY['monthly'::"text", 'semi_monthly'::"text", 'weekly'::"text", 'custom'::"text"]))),
    CONSTRAINT "staff_payroll_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "staff_payroll_runs_total_company_cost_vnd_check" CHECK (("total_company_cost_vnd" >= 0)),
    CONSTRAINT "staff_payroll_runs_total_gross_vnd_check" CHECK (("total_gross_vnd" >= 0)),
    CONSTRAINT "staff_payroll_runs_total_net_vnd_check" CHECK (("total_net_vnd" >= 0))
);


ALTER TABLE "public"."staff_payroll_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_payroll_source_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_key" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "employee_code" "text" NOT NULL,
    "employee_name" "text" NOT NULL,
    "division" "text",
    "employment_status" "text",
    "bank_name" "text",
    "bank_account_number" "text",
    "contract_rate_vnd" integer DEFAULT 0 NOT NULL,
    "worked_minutes" integer,
    "worked_days" numeric(9,4),
    "basic_days" numeric(7,2),
    "paid_leave_days" numeric(7,2) DEFAULT 0 NOT NULL,
    "salary_paid_minutes" integer DEFAULT 0 NOT NULL,
    "overtime_minutes" integer DEFAULT 0 NOT NULL,
    "meal_days" integer DEFAULT 0 NOT NULL,
    "base_pay_vnd" integer DEFAULT 0 NOT NULL,
    "meal_allowance_vnd" integer DEFAULT 0 NOT NULL,
    "overtime_pay_vnd" integer DEFAULT 0 NOT NULL,
    "gross_income_vnd" integer DEFAULT 0 NOT NULL,
    "taxable_income_vnd" integer DEFAULT 0 NOT NULL,
    "pit_withheld_vnd" integer DEFAULT 0 NOT NULL,
    "employee_insurance_vnd" integer DEFAULT 0 NOT NULL,
    "net_payable_vnd" integer DEFAULT 0 NOT NULL,
    "leave_opening" numeric(7,2),
    "leave_accrual" numeric(7,2),
    "leave_used" numeric(7,2),
    "leave_closing" numeric(7,2),
    "leave_payout_vnd" integer,
    "details" "text",
    "source_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_payroll_source_snapshots_base_pay_vnd_check" CHECK (("base_pay_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_basic_days_check" CHECK (("basic_days" >= (0)::numeric)),
    CONSTRAINT "staff_payroll_source_snapshots_contract_rate_vnd_check" CHECK (("contract_rate_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_employee_insurance_vnd_check" CHECK (("employee_insurance_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_gross_income_vnd_check" CHECK (("gross_income_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_meal_allowance_vnd_check" CHECK (("meal_allowance_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_meal_days_check" CHECK (("meal_days" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_net_payable_vnd_check" CHECK (("net_payable_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_overtime_minutes_check" CHECK (("overtime_minutes" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_overtime_pay_vnd_check" CHECK (("overtime_pay_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_paid_leave_days_check" CHECK (("paid_leave_days" >= (0)::numeric)),
    CONSTRAINT "staff_payroll_source_snapshots_period_order" CHECK (("period_end" >= "period_start")),
    CONSTRAINT "staff_payroll_source_snapshots_pit_withheld_vnd_check" CHECK (("pit_withheld_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_salary_paid_minutes_check" CHECK (("salary_paid_minutes" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_taxable_income_vnd_check" CHECK (("taxable_income_vnd" >= 0)),
    CONSTRAINT "staff_payroll_source_snapshots_worked_days_check" CHECK (("worked_days" >= (0)::numeric)),
    CONSTRAINT "staff_payroll_source_snapshots_worked_minutes_check" CHECK (("worked_minutes" >= 0))
);


ALTER TABLE "public"."staff_payroll_source_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_name" "text" NOT NULL,
    "game_id" "uuid",
    "day_type" "text" DEFAULT 'weekday'::"text" NOT NULL,
    "time_start" time without time zone,
    "time_end" time without time zone,
    "price_per_player" integer DEFAULT 0 NOT NULL,
    "price_per_arena_slot" integer,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_pricing_rules_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "staff_pricing_rules_check1" CHECK ((("time_start" IS NULL) OR ("time_end" IS NULL) OR ("time_start" < "time_end"))),
    CONSTRAINT "staff_pricing_rules_day_type_check" CHECK (("day_type" = ANY (ARRAY['weekday'::"text", 'weekend'::"text", 'holiday'::"text", 'custom'::"text"]))),
    CONSTRAINT "staff_pricing_rules_price_per_arena_slot_check" CHECK ((("price_per_arena_slot" IS NULL) OR ("price_per_arena_slot" >= 0))),
    CONSTRAINT "staff_pricing_rules_price_per_player_check" CHECK (("price_per_player" >= 0))
);


ALTER TABLE "public"."staff_pricing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_schedule_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_profile_id" "uuid" NOT NULL,
    "location" "text" DEFAULT 'VRena'::"text" NOT NULL,
    "shift_role" "text" DEFAULT 'Staff'::"text" NOT NULL,
    "shift_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "break_minutes" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "staff_schedule_shifts_break_minutes_check" CHECK (("break_minutes" >= 0)),
    CONSTRAINT "staff_schedule_shifts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."staff_schedule_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_zalo_attendance_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identity_id" "uuid",
    "staff_profile_id" "uuid",
    "attendance_log_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "staff_zalo_attendance_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['link'::"text", 'status'::"text", 'clock_in'::"text", 'clock_out'::"text", 'link_failed'::"text"]))),
    CONSTRAINT "staff_zalo_attendance_events_payload_object" CHECK (("jsonb_typeof"("event_payload") = 'object'::"text"))
);


ALTER TABLE "public"."staff_zalo_attendance_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_zalo_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_profile_id" "uuid" NOT NULL,
    "zalo_app_user_id" "text" NOT NULL,
    "verified_phone_last_four" "text",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoke_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_zalo_identities_phone_suffix_format" CHECK ((("verified_phone_last_four" IS NULL) OR ("verified_phone_last_four" ~ '^[0-9]{4}$'::"text"))),
    CONSTRAINT "staff_zalo_identities_user_id_length" CHECK ((("length"("zalo_app_user_id") >= 1) AND ("length"("zalo_app_user_id") <= 255)))
);


ALTER TABLE "public"."staff_zalo_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_zalo_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "require_location" boolean DEFAULT true NOT NULL,
    "allow_timesheet" boolean DEFAULT true NOT NULL,
    "allow_payslip" boolean DEFAULT false NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_zalo_settings_id_check" CHECK (("id" = 'default'::"text"))
);


ALTER TABLE "public"."staff_zalo_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_editors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_emoji" "text",
    "avatar_initials" "text",
    "avatar_color" "text",
    "profile_motto" "text",
    "avatar_text_color" "text",
    CONSTRAINT "tournament_editors_avatar_text_color_hex" CHECK ((("avatar_text_color" IS NULL) OR ("avatar_text_color" ~ '^#[0-9A-Fa-f]{6}$'::"text"))),
    CONSTRAINT "tournament_editors_profile_motto_length" CHECK ((("profile_motto" IS NULL) OR ("char_length"("profile_motto") <= 20)))
);


ALTER TABLE "public"."tournament_editors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "pool_id" "uuid",
    "stage" "text" DEFAULT 'pool'::"text" NOT NULL,
    "round" integer DEFAULT 1 NOT NULL,
    "match_number" integer DEFAULT 1 NOT NULL,
    "participant_a_id" "uuid",
    "participant_b_id" "uuid",
    "team_a_id" "uuid",
    "team_b_id" "uuid",
    "score_a" numeric,
    "score_b" numeric,
    "winner_participant_id" "uuid",
    "winner_team_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wins_a" integer DEFAULT 0,
    "wins_b" integer DEFAULT 0,
    "loser_participant_id" "uuid",
    "arena_number" integer,
    "queue_position" integer,
    "best_of" integer DEFAULT 1,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    CONSTRAINT "tournament_matches_arena_number_check" CHECK (("arena_number" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "tournament_matches_best_of_check" CHECK (("best_of" = ANY (ARRAY[1, 3, 5]))),
    CONSTRAINT "tournament_matches_no_same_player" CHECK ((("participant_a_id" IS NULL) OR ("participant_b_id" IS NULL) OR ("participant_a_id" <> "participant_b_id"))),
    CONSTRAINT "tournament_matches_stage_check" CHECK (("stage" = ANY (ARRAY['pool'::"text", 'round_of_16'::"text", 'quarterfinal'::"text", 'semifinal'::"text", 'final'::"text", 'third_place'::"text", 'leaderboard'::"text", 'custom'::"text"]))),
    CONSTRAINT "tournament_matches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'waiting'::"text", 'next'::"text", 'live'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."tournament_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_pool_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "pool_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "seed" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "team_label" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text"
);


ALTER TABLE "public"."tournament_pool_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_pools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text"
);


ALTER TABLE "public"."tournament_pools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "avatar_emoji" "text",
    "avatar_initials" "text",
    "avatar_color" "text",
    "avatar_text_color" "text",
    "profile_motto" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_game_result_duplicate_archive" (
    "archive_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_result_id" "uuid" NOT NULL,
    "archive_reason" "text" NOT NULL,
    "result_data" "jsonb" NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "venue_game_result_duplicate_archive_data_check" CHECK (("jsonb_typeof"("result_data") = 'object'::"text")),
    CONSTRAINT "venue_game_result_duplicate_archive_reason_check" CHECK ((("char_length"("archive_reason") >= 1) AND ("char_length"("archive_reason") <= 120)))
);


ALTER TABLE "public"."venue_game_result_duplicate_archive" OWNER TO "postgres";


COMMENT ON TABLE "public"."venue_game_result_duplicate_archive" IS 'Private, recoverable archive of venue result rows removed by round deduplication.';



CREATE TABLE IF NOT EXISTS "public"."venue_game_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "matched_session_id" "uuid",
    "matched_participant_id" "uuid",
    "player_name" "text" NOT NULL,
    "game_name" "text",
    "game_slug" "text",
    "score" integer NOT NULL,
    "hits" integer NOT NULL,
    "accuracy_percent" double precision,
    "movement_meters" numeric(10,2),
    "external_session_label" "text",
    "captured_at" timestamp with time zone NOT NULL,
    "source_capture_id" "text" NOT NULL,
    "source_device" "text" DEFAULT 'VRena Results Capture'::"text" NOT NULL,
    "match_status" "text" DEFAULT 'player_only'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "venue_key" "text" DEFAULT 'ha-do-centrosa'::"text" NOT NULL,
    CONSTRAINT "venue_game_results_accuracy_check" CHECK ((("accuracy_percent" IS NULL) OR (("accuracy_percent" >= (0)::double precision) AND ("accuracy_percent" <= (100)::double precision)))),
    CONSTRAINT "venue_game_results_game_name_check" CHECK ((("game_name" IS NULL) OR ("char_length"("game_name") <= 120))),
    CONSTRAINT "venue_game_results_game_slug_check" CHECK ((("game_slug" IS NULL) OR ("game_slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))),
    CONSTRAINT "venue_game_results_hits_check" CHECK (("hits" >= 0)),
    CONSTRAINT "venue_game_results_match_status_check" CHECK (("match_status" = ANY (ARRAY['session_matched'::"text", 'player_only'::"text", 'session_ambiguous'::"text"]))),
    CONSTRAINT "venue_game_results_movement_check" CHECK ((("movement_meters" IS NULL) OR ("movement_meters" >= (0)::numeric))),
    CONSTRAINT "venue_game_results_player_name_check" CHECK ((("char_length"("player_name") >= 1) AND ("char_length"("player_name") <= 80))),
    CONSTRAINT "venue_game_results_score_check" CHECK (("score" >= 0)),
    CONSTRAINT "venue_game_results_session_pair_check" CHECK (((("match_status" = 'session_matched'::"text") AND ("matched_session_id" IS NOT NULL) AND ("matched_participant_id" IS NOT NULL)) OR (("match_status" <> 'session_matched'::"text") AND ("matched_session_id" IS NULL) AND ("matched_participant_id" IS NULL)))),
    CONSTRAINT "venue_game_results_source_capture_check" CHECK ((("char_length"("source_capture_id") >= 16) AND ("char_length"("source_capture_id") <= 128))),
    CONSTRAINT "venue_game_results_venue_key_check" CHECK (("venue_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."venue_game_results" OWNER TO "postgres";


COMMENT ON TABLE "public"."venue_game_results" IS 'Auditable VR result-screen imports. Results without a unique session match remain profile-only.';



CREATE TABLE IF NOT EXISTS "public"."venue_result_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_capture_id" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "captured_at" timestamp with time zone NOT NULL,
    "source_device" "text" NOT NULL,
    "app_version" "text" NOT NULL,
    "review_reason" "text" NOT NULL,
    "sha256" "text" NOT NULL,
    "ocr_text" "text" DEFAULT ''::"text" NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "venue_key" "text" DEFAULT 'ha-do-centrosa'::"text" NOT NULL,
    "file_size_bytes" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "venue_result_reviews_app_version_check" CHECK ((("char_length"("app_version") >= 1) AND ("char_length"("app_version") <= 40))),
    CONSTRAINT "venue_result_reviews_capture_id_check" CHECK (("source_capture_id" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "venue_result_reviews_file_size_check" CHECK ((("file_size_bytes" >= 1) AND ("file_size_bytes" <= 2000000))),
    CONSTRAINT "venue_result_reviews_notes_check" CHECK ((("review_notes" IS NULL) OR ("char_length"("review_notes") <= 2000))),
    CONSTRAINT "venue_result_reviews_ocr_text_check" CHECK (("char_length"("ocr_text") <= 100000)),
    CONSTRAINT "venue_result_reviews_reason_check" CHECK (("review_reason" = ANY (ARRAY['game_not_recognized'::"text", 'players_not_recognized'::"text", 'escape_time_not_recognized'::"text", 'player_rows_conflict'::"text", 'player_rows_incomplete'::"text", 'player_count_invalid'::"text"]))),
    CONSTRAINT "venue_result_reviews_review_pair_check" CHECK (((("review_status" = 'pending'::"text") AND ("reviewed_at" IS NULL)) OR (("review_status" <> 'pending'::"text") AND ("reviewed_at" IS NOT NULL)))),
    CONSTRAINT "venue_result_reviews_sha256_check" CHECK (("sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "venue_result_reviews_source_device_check" CHECK ((("char_length"("source_device") >= 1) AND ("char_length"("source_device") <= 120))),
    CONSTRAINT "venue_result_reviews_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "venue_result_reviews_storage_path_check" CHECK (("storage_path" ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]{36}/[0-9a-f]{64}\.jpg$'::"text")),
    CONSTRAINT "venue_result_reviews_venue_key_check" CHECK (("venue_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."venue_result_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."venue_result_reviews" IS 'Private queue of result screenshots that the Windows capture app could not recognize completely.';



CREATE TABLE IF NOT EXISTS "public"."venue_support_bundle_download_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bundle_id" "uuid" NOT NULL,
    "token_digest" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "venue_support_bundle_download_token_digest_check" CHECK (("token_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "venue_support_bundle_download_token_expiry_check" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."venue_support_bundle_download_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."venue_support_bundle_download_tokens" IS 'Hashed, expiring, single-use tokens for private support bundle retrieval.';



CREATE TABLE IF NOT EXISTS "public"."venue_support_bundles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size_bytes" integer NOT NULL,
    "sha256" "text" NOT NULL,
    "source_device" "text" NOT NULL,
    "app_version" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "venue_key" "text" DEFAULT 'ha-do-centrosa'::"text" NOT NULL,
    CONSTRAINT "venue_support_bundles_app_version_check" CHECK ((("char_length"("app_version") >= 1) AND ("char_length"("app_version") <= 40))),
    CONSTRAINT "venue_support_bundles_file_name_check" CHECK (("file_name" ~ '^VRena-Results-Capture-Support-[0-9]{8}-[0-9]{6}\.zip$'::"text")),
    CONSTRAINT "venue_support_bundles_file_size_check" CHECK ((("file_size_bytes" >= 1) AND ("file_size_bytes" <= 3500000))),
    CONSTRAINT "venue_support_bundles_sha256_check" CHECK (("sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "venue_support_bundles_source_device_check" CHECK ((("char_length"("source_device") >= 1) AND ("char_length"("source_device") <= 120))),
    CONSTRAINT "venue_support_bundles_storage_path_check" CHECK (("storage_path" ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]{36}/[^/]+\.zip$'::"text")),
    CONSTRAINT "venue_support_bundles_venue_key_check" CHECK (("venue_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."venue_support_bundles" OWNER TO "postgres";


COMMENT ON TABLE "public"."venue_support_bundles" IS 'Private metadata for operator-initiated Windows support bundle uploads.';



CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "code" "text" NOT NULL,
    "discount_rate" numeric(5,4) DEFAULT 0.10 NOT NULL,
    "individual_only" boolean DEFAULT true NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vouchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zalo_webhook_receipts" (
    "event_digest" "text" NOT NULL,
    "event_timestamp" timestamp with time zone NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "zalo_webhook_receipts_digest_check" CHECK (("event_digest" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."zalo_webhook_receipts" OWNER TO "postgres";


ALTER TABLE ONLY "private"."integration_settings"
    ADD CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "private"."staff_kiosk_operator_sessions"
    ADD CONSTRAINT "staff_kiosk_operator_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "private"."staff_kiosk_operator_sessions"
    ADD CONSTRAINT "staff_kiosk_operator_sessions_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "private"."staff_kiosk_pin_attempts"
    ADD CONSTRAINT "staff_kiosk_pin_attempts_pkey" PRIMARY KEY ("auth_user_id", "user_agent_hash");



ALTER TABLE ONLY "private"."staff_kiosk_pin_credentials"
    ADD CONSTRAINT "staff_kiosk_pin_credentials_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "private"."venue_upload_reservations"
    ADD CONSTRAINT "venue_upload_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_analytics_events"
    ADD CONSTRAINT "app_analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_times"
    ADD CONSTRAINT "blocked_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_messages"
    ADD CONSTRAINT "club_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "import { supabase } from '../../lib/supabase/client'_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_point_transactions"
    ADD CONSTRAINT "loyalty_point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_list"
    ADD CONSTRAINT "marketing_list_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."message_translations"
    ADD CONSTRAINT "message_translations_message_table_message_id_source_body_h_key" UNIQUE ("message_table", "message_id", "source_body_hash", "target_language");



ALTER TABLE ONLY "public"."message_translations"
    ADD CONSTRAINT "message_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_stat_overrides"
    ADD CONSTRAINT "player_stat_overrides_pkey" PRIMARY KEY ("profile_id", "scope");



ALTER TABLE ONLY "public"."player_zalo_handoffs"
    ADD CONSTRAINT "player_zalo_handoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_zalo_handoffs"
    ADD CONSTRAINT "player_zalo_handoffs_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."player_zalo_identities"
    ADD CONSTRAINT "player_zalo_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_zalo_identities"
    ADD CONSTRAINT "player_zalo_identities_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."player_zalo_identities"
    ADD CONSTRAINT "player_zalo_identities_verified_phone_key" UNIQUE ("verified_phone");



ALTER TABLE ONLY "public"."player_zalo_identities"
    ADD CONSTRAINT "player_zalo_identities_zalo_app_user_id_key" UNIQUE ("zalo_app_user_id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_achievement_awards"
    ADD CONSTRAINT "profile_achievement_awards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_achievement_unlock_views"
    ADD CONSTRAINT "profile_achievement_unlock_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_events"
    ADD CONSTRAINT "push_events_event_key_key" UNIQUE ("event_key");



ALTER TABLE ONLY "public"."push_events"
    ADD CONSTRAINT "push_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_rate_limits"
    ADD CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_rate_limits"
    ADD CONSTRAINT "security_rate_limits_subject_hash_action_window_started_at_key" UNIQUE ("subject_hash", "action", "window_started_at");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_session_id_recipient_id_key" UNIQUE ("session_id", "recipient_id");



ALTER TABLE ONLY "public"."session_messages"
    ADD CONSTRAINT "session_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_t_participant_id_game_slug_chap_key" UNIQUE ("participant_id", "game_slug", "chapter_number");



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_participants"
    ADD CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_session_id_profile_id_key" UNIQUE ("session_id", "profile_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_attendance_approvals"
    ADD CONSTRAINT "staff_attendance_approvals_period_start_period_end_key" UNIQUE ("period_start", "period_end");



ALTER TABLE ONLY "public"."staff_attendance_approvals"
    ADD CONSTRAINT "staff_attendance_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_attendance_settings"
    ADD CONSTRAINT "staff_attendance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_check_in_locations"
    ADD CONSTRAINT "staff_check_in_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_cost_assignments"
    ADD CONSTRAINT "staff_cost_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_cost_assignments"
    ADD CONSTRAINT "staff_cost_assignments_profile_id_daterange_excl" EXCLUDE USING "gist" ("profile_id" WITH =, "daterange"("start_date", "end_date", '[]'::"text") WITH &&) WHERE (("cancelled_at" IS NULL));



ALTER TABLE ONLY "public"."staff_discount_rules"
    ADD CONSTRAINT "staff_discount_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_employee_profiles"
    ADD CONSTRAINT "staff_employee_profiles_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."staff_games"
    ADD CONSTRAINT "staff_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_games"
    ADD CONSTRAINT "staff_games_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."staff_hr_adjustments"
    ADD CONSTRAINT "staff_hr_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_hr_documents"
    ADD CONSTRAINT "staff_hr_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_hr_policy_versions"
    ADD CONSTRAINT "staff_hr_policy_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_hr_policy_versions"
    ADD CONSTRAINT "staff_hr_policy_versions_policy_version_effective_from_key" UNIQUE ("policy_version", "effective_from");



ALTER TABLE ONLY "public"."staff_hr_settings"
    ADD CONSTRAINT "staff_hr_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_hr_setup_options"
    ADD CONSTRAINT "staff_hr_setup_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_leave_requests"
    ADD CONSTRAINT "staff_leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_loyalty_rules"
    ADD CONSTRAINT "staff_loyalty_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_order_payments"
    ADD CONSTRAINT "staff_order_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_payroll_items"
    ADD CONSTRAINT "staff_payroll_items_payroll_run_id_profile_id_key" UNIQUE ("payroll_run_id", "profile_id");



ALTER TABLE ONLY "public"."staff_payroll_items"
    ADD CONSTRAINT "staff_payroll_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_payroll_runs"
    ADD CONSTRAINT "staff_payroll_runs_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."staff_payroll_runs"
    ADD CONSTRAINT "staff_payroll_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_payroll_source_snapshots"
    ADD CONSTRAINT "staff_payroll_source_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_payroll_source_snapshots"
    ADD CONSTRAINT "staff_payroll_source_snapshots_source_key_employee_code_key" UNIQUE ("source_key", "employee_code");



ALTER TABLE ONLY "public"."staff_pricing_rules"
    ADD CONSTRAINT "staff_pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedule_shifts"
    ADD CONSTRAINT "staff_schedule_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_zalo_attendance_events"
    ADD CONSTRAINT "staff_zalo_attendance_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_zalo_identities"
    ADD CONSTRAINT "staff_zalo_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_zalo_identities"
    ADD CONSTRAINT "staff_zalo_identities_staff_profile_id_key" UNIQUE ("staff_profile_id");



ALTER TABLE ONLY "public"."staff_zalo_identities"
    ADD CONSTRAINT "staff_zalo_identities_zalo_app_user_id_key" UNIQUE ("zalo_app_user_id");



ALTER TABLE ONLY "public"."staff_zalo_settings"
    ADD CONSTRAINT "staff_zalo_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_audit_log"
    ADD CONSTRAINT "tournament_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_editors"
    ADD CONSTRAINT "tournament_editors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_editors"
    ADD CONSTRAINT "tournament_editors_session_id_profile_id_key" UNIQUE ("session_id", "profile_id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_pool_entries"
    ADD CONSTRAINT "tournament_pool_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_pool_entries"
    ADD CONSTRAINT "tournament_pool_entries_pool_id_participant_id_key" UNIQUE ("pool_id", "participant_id");



ALTER TABLE ONLY "public"."tournament_pools"
    ADD CONSTRAINT "tournament_pools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_team_members"
    ADD CONSTRAINT "tournament_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_team_members"
    ADD CONSTRAINT "tournament_team_members_team_id_participant_id_key" UNIQUE ("team_id", "participant_id");



ALTER TABLE ONLY "public"."tournament_teams"
    ADD CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_game_result_duplicate_archive"
    ADD CONSTRAINT "venue_game_result_duplicate_archive_original_result_id_key" UNIQUE ("original_result_id");



ALTER TABLE ONLY "public"."venue_game_result_duplicate_archive"
    ADD CONSTRAINT "venue_game_result_duplicate_archive_pkey" PRIMARY KEY ("archive_id");



ALTER TABLE ONLY "public"."venue_game_results"
    ADD CONSTRAINT "venue_game_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_game_results"
    ADD CONSTRAINT "venue_game_results_source_capture_id_player_name_key" UNIQUE ("source_capture_id", "player_name");



ALTER TABLE ONLY "public"."venue_result_reviews"
    ADD CONSTRAINT "venue_result_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_result_reviews"
    ADD CONSTRAINT "venue_result_reviews_source_capture_id_key" UNIQUE ("source_capture_id");



ALTER TABLE ONLY "public"."venue_result_reviews"
    ADD CONSTRAINT "venue_result_reviews_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."venue_support_bundle_download_tokens"
    ADD CONSTRAINT "venue_support_bundle_download_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_support_bundle_download_tokens"
    ADD CONSTRAINT "venue_support_bundle_download_tokens_token_digest_key" UNIQUE ("token_digest");



ALTER TABLE ONLY "public"."venue_support_bundles"
    ADD CONSTRAINT "venue_support_bundles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_support_bundles"
    ADD CONSTRAINT "venue_support_bundles_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."zalo_webhook_receipts"
    ADD CONSTRAINT "zalo_webhook_receipts_pkey" PRIMARY KEY ("event_digest");



CREATE INDEX "staff_kiosk_sessions_active_idx" ON "private"."staff_kiosk_operator_sessions" USING "btree" ("auth_user_id", "last_activity_at" DESC) WHERE ("revoked_at" IS NULL);



CREATE INDEX "app_analytics_events_created_at_idx" ON "public"."app_analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "app_analytics_events_event_created_idx" ON "public"."app_analytics_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "app_analytics_events_path_created_idx" ON "public"."app_analytics_events" USING "btree" ("path", "created_at" DESC);



CREATE INDEX "app_analytics_events_profile_created_idx" ON "public"."app_analytics_events" USING "btree" ("profile_id", "created_at" DESC) WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "app_analytics_events_session_created_idx" ON "public"."app_analytics_events" USING "btree" ("session_id", "created_at", "id");



CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "audit_logs_operator_session_idx" ON "public"."audit_logs" USING "btree" ("operator_session_id", "created_at" DESC) WHERE ("operator_session_id" IS NOT NULL);



CREATE UNIQUE INDEX "club_members_active_club_profile_key" ON "public"."club_members" USING "btree" ("club_id", "profile_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "club_members_active_deleted_at_idx" ON "public"."club_members" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "club_messages_club_created_idx" ON "public"."club_messages" USING "btree" ("club_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "club_messages_club_type_created_idx" ON "public"."club_messages" USING "btree" ("club_id", "message_type", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "loyalty_point_transactions_auto_source_idx" ON "public"."loyalty_point_transactions" USING "btree" ("profile_id", "source_type", "source_id", "rule_id") WHERE (("source_type" = 'staff_order'::"text") AND ("source_id" IS NOT NULL));



CREATE INDEX "loyalty_point_transactions_profile_idx" ON "public"."loyalty_point_transactions" USING "btree" ("profile_id", "created_at" DESC);



CREATE UNIQUE INDEX "loyalty_point_transactions_ticket_redemption_source_idx" ON "public"."loyalty_point_transactions" USING "btree" ("profile_id", "source_type", "source_id") WHERE (("source_type" = 'ticket_redemption'::"text") AND ("source_id" IS NOT NULL));



CREATE INDEX "message_translations_message_idx" ON "public"."message_translations" USING "btree" ("message_table", "message_id");



CREATE INDEX "player_stat_overrides_updated_by_idx" ON "public"."player_stat_overrides" USING "btree" ("updated_by", "updated_at" DESC);



CREATE INDEX "player_zalo_handoffs_active_token_idx" ON "public"."player_zalo_handoffs" USING "btree" ("token_hash", "expires_at") WHERE ("consumed_at" IS NULL);



CREATE INDEX "player_zalo_handoffs_profile_created_idx" ON "public"."player_zalo_handoffs" USING "btree" ("profile_id", "created_at" DESC);



CREATE UNIQUE INDEX "pricing_rules_name_key" ON "public"."pricing_rules" USING "btree" ("name");



CREATE UNIQUE INDEX "profile_achievement_awards_active_unique" ON "public"."profile_achievement_awards" USING "btree" ("profile_id", "achievement_kind", "achievement_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "profile_achievement_awards_awarded_by_idx" ON "public"."profile_achievement_awards" USING "btree" ("awarded_by", "awarded_at" DESC);



CREATE INDEX "profile_achievement_awards_profile_active_idx" ON "public"."profile_achievement_awards" USING "btree" ("profile_id", "awarded_at" DESC) WHERE ("revoked_at" IS NULL);



CREATE INDEX "profile_achievement_unlock_views_profile_idx" ON "public"."profile_achievement_unlock_views" USING "btree" ("profile_id", "first_seen_at" DESC);



CREATE UNIQUE INDEX "profile_achievement_unlock_views_unique" ON "public"."profile_achievement_unlock_views" USING "btree" ("profile_id", "achievement_kind", "achievement_id", "achievement_tier");



CREATE INDEX "profiles_active_deleted_at_idx" ON "public"."profiles" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "profiles_active_full_name_identity_idx" ON "public"."profiles" USING "btree" ("public"."normalize_player_identity"("full_name")) WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "profiles_active_nickname_identity_idx" ON "public"."profiles" USING "btree" ("public"."normalize_player_identity"("nickname")) WHERE (("deleted_at" IS NULL) AND (NOT COALESCE("is_hr_record_only", false)));



CREATE INDEX "profiles_active_search_idx" ON "public"."profiles" USING "btree" ("lower"(COALESCE("nickname", "full_name", "phone", "email", ''::"text")), "id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "profiles_banned_at_idx" ON "public"."profiles" USING "btree" ("banned_at") WHERE ("banned_at" IS NOT NULL);



CREATE INDEX "profiles_phone_lookup_idx" ON "public"."profiles" USING "btree" ("phone") WHERE (("phone" IS NOT NULL) AND ("btrim"("phone") <> ''::"text"));



CREATE INDEX "profiles_seed_demo_batch_idx" ON "public"."profiles" USING "btree" ("is_seed_demo", "seed_batch");



CREATE INDEX "push_events_due_idx" ON "public"."push_events" USING "btree" ("status", "scheduled_for", "created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "push_events_recipient_created_idx" ON "public"."push_events" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "push_subscriptions_profile_active_idx" ON "public"."push_subscriptions" USING "btree" ("profile_id", "updated_at" DESC) WHERE ("disabled_at" IS NULL);



CREATE INDEX "security_rate_limits_reset_idx" ON "public"."security_rate_limits" USING "btree" ("reset_at");



CREATE INDEX "session_messages_active_deleted_at_idx" ON "public"."session_messages" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "session_messages_session_created_active_idx" ON "public"."session_messages" USING "btree" ("session_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "session_messages_session_status_idx" ON "public"."session_messages" USING "btree" ("session_id", "moderation_status", "created_at");



CREATE INDEX "session_participant_chapter_times_profile_idx" ON "public"."session_participant_chapter_times" USING "btree" ("profile_id", "game_slug", "chapter_number", "duration_seconds");



CREATE INDEX "session_participant_chapter_times_session_idx" ON "public"."session_participant_chapter_times" USING "btree" ("session_id", "participant_id");



CREATE INDEX "session_participants_active_deleted_at_idx" ON "public"."session_participants" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "session_participants_active_session_profile_key" ON "public"."session_participants" USING "btree" ("session_id", "profile_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "session_participants_escape_duration_idx" ON "public"."session_participants" USING "btree" ("escape_duration_seconds") WHERE ("escape_duration_seconds" IS NOT NULL);



CREATE INDEX "session_participants_profile_session_idx" ON "public"."session_participants" USING "btree" ("profile_id", "session_id");



CREATE INDEX "session_participants_session_active_idx" ON "public"."session_participants" USING "btree" ("session_id", "profile_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "session_participants_session_profile_idx" ON "public"."session_participants" USING "btree" ("session_id", "profile_id");



CREATE INDEX "session_waitlist_session_created_idx" ON "public"."session_waitlist" USING "btree" ("session_id", "created_at");



CREATE INDEX "sessions_active_date_start_idx" ON "public"."sessions" USING "btree" ("date", "start_time") WHERE ("status" <> 'cancelled'::"text");



CREATE INDEX "sessions_active_deleted_at_idx" ON "public"."sessions" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "sessions_booking_type_date_idx" ON "public"."sessions" USING "btree" ("booking_type", "date", "start_time");



CREATE INDEX "sessions_challenge_target_date_idx" ON "public"."sessions" USING "btree" ("challenge_target_id", "date", "start_time") WHERE ("booking_type" = 'challenge'::"text");



CREATE INDEX "sessions_list_page_active_idx" ON "public"."sessions" USING "btree" ("date", "start_time", "id") WHERE (("deleted_at" IS NULL) AND ("status" <> 'cancelled'::"text"));



CREATE INDEX "sessions_seeded_batch_idx" ON "public"."sessions" USING "btree" ("seeded", "seed_batch");



CREATE INDEX "sessions_ticket_customer_idx" ON "public"."sessions" USING "btree" ("ticket_customer_id") WHERE ("booking_type" = 'ticket'::"text");



CREATE INDEX "sessions_ticket_discount_customer_idx" ON "public"."sessions" USING "btree" ("ticket_customer_id", "ticket_discount_rule_id") WHERE (("ticket_customer_id" IS NOT NULL) AND ("ticket_discount_rule_id" IS NOT NULL));



CREATE UNIQUE INDEX "sessions_ticket_reference_unique_idx" ON "public"."sessions" USING "btree" ("ticket_reference") WHERE ("ticket_reference" IS NOT NULL);



CREATE INDEX "sessions_venue_date_idx" ON "public"."sessions" USING "btree" ("venue_key", "date", "start_time") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_attendance_logs_approval_idx" ON "public"."staff_attendance_logs" USING "btree" ("approval_status", "work_date", "staff_profile_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_attendance_logs_staff_idx" ON "public"."staff_attendance_logs" USING "btree" ("staff_profile_id", "work_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_attendance_logs_week_idx" ON "public"."staff_attendance_logs" USING "btree" ("work_date", "clock_in_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_check_in_locations_active_idx" ON "public"."staff_check_in_locations" USING "btree" ("active", "name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_discount_rules_active_idx" ON "public"."staff_discount_rules" USING "btree" ("active", "valid_from", "valid_until");



CREATE UNIQUE INDEX "staff_discount_rules_code_unique_idx" ON "public"."staff_discount_rules" USING "btree" ("lower"("code")) WHERE (("code" IS NOT NULL) AND ("btrim"("code") <> ''::"text"));



CREATE INDEX "staff_discount_rules_conditions_idx" ON "public"."staff_discount_rules" USING "btree" ("active", "day_scope", "ticket_type", "valid_from", "valid_until");



CREATE INDEX "staff_discount_rules_game_idx" ON "public"."staff_discount_rules" USING "btree" ("game_id") WHERE ("game_id" IS NOT NULL);



CREATE INDEX "staff_discount_rules_price_rule_idx" ON "public"."staff_discount_rules" USING "btree" ("price_rule_id") WHERE ("price_rule_id" IS NOT NULL);



CREATE INDEX "staff_employee_profiles_active_idx" ON "public"."staff_employee_profiles" USING "btree" ("active") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "staff_employee_profiles_employee_code_idx" ON "public"."staff_employee_profiles" USING "btree" ("lower"("employee_code")) WHERE (("deleted_at" IS NULL) AND ("employee_code" IS NOT NULL));



CREATE INDEX "staff_employee_profiles_hr_filters_idx" ON "public"."staff_employee_profiles" USING "btree" ("active", "contract_status", "department", "main_work_location") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_games_active_idx" ON "public"."staff_games" USING "btree" ("active", "name");



CREATE INDEX "staff_hr_adjustments_profile_period_idx" ON "public"."staff_hr_adjustments" USING "btree" ("profile_id", "effective_date", "status", "adjustment_type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_hr_documents_profile_idx" ON "public"."staff_hr_documents" USING "btree" ("profile_id", "document_type", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_hr_policy_versions_created_by_idx" ON "public"."staff_hr_policy_versions" USING "btree" ("created_by");



CREATE INDEX "staff_hr_setup_options_type_idx" ON "public"."staff_hr_setup_options" USING "btree" ("option_type", "active", "sort_order") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "staff_hr_setup_options_type_name_idx" ON "public"."staff_hr_setup_options" USING "btree" ("option_type", "lower"("name")) WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_leave_requests_range_idx" ON "public"."staff_leave_requests" USING "btree" ("start_date", "end_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_leave_requests_staff_idx" ON "public"."staff_leave_requests" USING "btree" ("staff_profile_id", "start_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_loyalty_rules_lookup_idx" ON "public"."staff_loyalty_rules" USING "btree" ("active", "game_id", "calculation_type", "valid_from", "valid_until");



CREATE UNIQUE INDEX "staff_loyalty_rules_one_active_idx" ON "public"."staff_loyalty_rules" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "staff_order_payments_order_idx" ON "public"."staff_order_payments" USING "btree" ("order_id", "created_at");



CREATE INDEX "staff_orders_booking_date_idx" ON "public"."staff_orders" USING "btree" ("booking_date", "booking_time");



CREATE INDEX "staff_orders_customer_idx" ON "public"."staff_orders" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "staff_orders_page_idx" ON "public"."staff_orders" USING "btree" ("booking_date" DESC, "booking_time" DESC, "created_at" DESC);



CREATE INDEX "staff_orders_session_idx" ON "public"."staff_orders" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "staff_orders_status_idx" ON "public"."staff_orders" USING "btree" ("order_status", "payment_status", "booking_date");



CREATE INDEX "staff_payroll_items_profile_idx" ON "public"."staff_payroll_items" USING "btree" ("profile_id", "payroll_run_id", "status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_payroll_runs_period_idx" ON "public"."staff_payroll_runs" USING "btree" ("period_start", "period_end", "status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_payroll_source_snapshots_period_idx" ON "public"."staff_payroll_source_snapshots" USING "btree" ("period_start", "period_end", "employee_code");



CREATE INDEX "staff_pricing_rules_lookup_idx" ON "public"."staff_pricing_rules" USING "btree" ("active", "game_id", "day_type", "valid_from", "valid_until");



CREATE INDEX "staff_pricing_rules_time_idx" ON "public"."staff_pricing_rules" USING "btree" ("time_start", "time_end") WHERE ("active" = true);



CREATE INDEX "staff_schedule_shifts_staff_idx" ON "public"."staff_schedule_shifts" USING "btree" ("staff_profile_id", "shift_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_schedule_shifts_week_idx" ON "public"."staff_schedule_shifts" USING "btree" ("shift_date", "start_time") WHERE ("deleted_at" IS NULL);



CREATE INDEX "staff_zalo_attendance_events_identity_time_idx" ON "public"."staff_zalo_attendance_events" USING "btree" ("identity_id", "event_at" DESC);



CREATE INDEX "staff_zalo_attendance_events_staff_time_idx" ON "public"."staff_zalo_attendance_events" USING "btree" ("staff_profile_id", "event_at" DESC);



CREATE INDEX "staff_zalo_identities_active_user_idx" ON "public"."staff_zalo_identities" USING "btree" ("zalo_app_user_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "tournament_audit_log_session_created_idx" ON "public"."tournament_audit_log" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "tournament_matches_active_deleted_at_idx" ON "public"."tournament_matches" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "tournament_matches_queue_idx" ON "public"."tournament_matches" USING "btree" ("session_id", "status", "arena_number", "queue_position");



CREATE INDEX "tournament_pool_entries_active_deleted_at_idx" ON "public"."tournament_pool_entries" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "tournament_pool_entries_pool_idx" ON "public"."tournament_pool_entries" USING "btree" ("session_id", "pool_id");



CREATE INDEX "tournament_pools_active_deleted_at_idx" ON "public"."tournament_pools" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "venue_game_results_profile_captured_idx" ON "public"."venue_game_results" USING "btree" ("profile_id", "captured_at" DESC);



CREATE UNIQUE INDEX "venue_game_results_profile_external_session_day_uidx" ON "public"."venue_game_results" USING "btree" ("venue_key", "profile_id", ((("captured_at" AT TIME ZONE 'Asia/Ho_Chi_Minh'::"text"))::"date"), "lower"("btrim"("external_session_label"))) WHERE (NULLIF("btrim"("external_session_label"), ''::"text") IS NOT NULL);



CREATE INDEX "venue_game_results_session_idx" ON "public"."venue_game_results" USING "btree" ("matched_session_id", "matched_participant_id") WHERE ("matched_session_id" IS NOT NULL);



CREATE INDEX "venue_game_results_unmatched_profile_idx" ON "public"."venue_game_results" USING "btree" ("profile_id", "captured_at" DESC) WHERE ("matched_participant_id" IS NULL);



CREATE INDEX "venue_result_reviews_pending_idx" ON "public"."venue_result_reviews" USING "btree" ("created_at") WHERE ("review_status" = 'pending'::"text");



CREATE INDEX "venue_result_reviews_reviewed_by_idx" ON "public"."venue_result_reviews" USING "btree" ("reviewed_by") WHERE ("reviewed_by" IS NOT NULL);



CREATE INDEX "venue_support_bundle_download_tokens_bundle_idx" ON "public"."venue_support_bundle_download_tokens" USING "btree" ("bundle_id", "created_at" DESC);



CREATE INDEX "venue_support_bundles_uploaded_idx" ON "public"."venue_support_bundles" USING "btree" ("uploaded_at" DESC);



CREATE INDEX "zalo_webhook_receipts_received_idx" ON "public"."zalo_webhook_receipts" USING "btree" ("received_at" DESC);



CREATE OR REPLACE TRIGGER "audit_logs_staff_kiosk_attribution" BEFORE INSERT ON "public"."audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."attribute_staff_kiosk_audit"();



CREATE OR REPLACE TRIGGER "club_members_refresh_member_count" AFTER INSERT OR DELETE OR UPDATE OF "club_id", "status", "deleted_at" ON "public"."club_members" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_club_member_count_trigger"();



CREATE OR REPLACE TRIGGER "club_messages_enqueue_admin_push" AFTER INSERT ON "public"."club_messages" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_club_admin_message_push"();



CREATE OR REPLACE TRIGGER "enforce_staff_kiosk_department_eligibility" BEFORE INSERT OR UPDATE OF "department", "kiosk_access_role", "kiosk_pin_configured_at" ON "public"."staff_employee_profiles" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_staff_kiosk_department_eligibility"();



CREATE OR REPLACE TRIGGER "player_stat_overrides_touch_updated_at" BEFORE UPDATE ON "public"."player_stat_overrides" FOR EACH ROW EXECUTE FUNCTION "private"."player_stat_overrides_touch_updated_at"();



CREATE OR REPLACE TRIGGER "player_zalo_identities_touch_updated_at" BEFORE UPDATE ON "public"."player_zalo_identities" FOR EACH ROW EXECUTE FUNCTION "private"."player_zalo_touch_updated_at"();



CREATE OR REPLACE TRIGGER "profile_achievement_awards_touch_updated_at" BEFORE UPDATE ON "public"."profile_achievement_awards" FOR EACH ROW EXECUTE FUNCTION "public"."profile_achievement_awards_touch_updated_at"();



CREATE OR REPLACE TRIGGER "profile_achievement_unlock_views_touch_updated_at" BEFORE UPDATE ON "public"."profile_achievement_unlock_views" FOR EACH ROW EXECUTE FUNCTION "public"."profile_achievement_unlock_views_touch_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_hr_only_identity_guard" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."guard_hr_only_profile_identity"();



CREATE OR REPLACE TRIGGER "profiles_normalize_optional_contact_fields" BEFORE INSERT OR UPDATE OF "email" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."normalize_profile_optional_contact_fields"();



CREATE OR REPLACE TRIGGER "profiles_protect_loyalty_points_total" BEFORE UPDATE OF "loyalty_points_total" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_loyalty_points_total"();



CREATE OR REPLACE TRIGGER "profiles_protect_minor_birthday" BEFORE UPDATE OF "birthday" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_minor_birthday_change"();



CREATE OR REPLACE TRIGGER "profiles_protect_role" BEFORE INSERT OR UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_role"();



CREATE OR REPLACE TRIGGER "profiles_protect_sensitive_fields" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_sensitive_fields"();



CREATE OR REPLACE TRIGGER "profiles_unique_player_identity" BEFORE INSERT OR UPDATE OF "nickname", "deleted_at", "is_hr_record_only" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_unique_player_identity"();



CREATE OR REPLACE TRIGGER "session_invites_enqueue_push" AFTER INSERT ON "public"."session_invites" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "public"."enqueue_session_invite_push"();



CREATE OR REPLACE TRIGGER "session_invites_rate_limit_writes" BEFORE INSERT OR UPDATE ON "public"."session_invites" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "public"."rate_limit_session_invites"();



CREATE OR REPLACE TRIGGER "session_invites_sync_challenge_status" AFTER UPDATE OF "status" ON "public"."session_invites" FOR EACH ROW EXECUTE FUNCTION "public"."sync_challenge_invite_status"();



CREATE OR REPLACE TRIGGER "session_participant_chapter_times_set_updated_at" BEFORE UPDATE ON "public"."session_participant_chapter_times" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "session_participants_a_sync_legacy_hits" BEFORE INSERT OR UPDATE ON "public"."session_participants" FOR EACH ROW EXECUTE FUNCTION "public"."sync_session_participant_legacy_hits"();



CREATE OR REPLACE TRIGGER "session_participants_promote_waitlist_after_delete" AFTER DELETE ON "public"."session_participants" FOR EACH ROW EXECUTE FUNCTION "public"."promote_waitlist_after_participant_departure"();



CREATE OR REPLACE TRIGGER "session_participants_promote_waitlist_after_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."session_participants" FOR EACH ROW WHEN ((("old"."deleted_at" IS NULL) AND ("new"."deleted_at" IS NOT NULL))) EXECUTE FUNCTION "public"."promote_waitlist_after_participant_departure"();



CREATE OR REPLACE TRIGGER "session_participants_protect_trusted_fields" BEFORE INSERT OR UPDATE ON "public"."session_participants" FOR EACH ROW EXECUTE FUNCTION "public"."protect_session_participant_trusted_fields"();



CREATE OR REPLACE TRIGGER "session_participants_set_updated_at" BEFORE UPDATE ON "public"."session_participants" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "sessions_enqueue_change_push" AFTER UPDATE OF "name", "date", "start_time", "duration_minutes", "status" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_session_change_push"();



CREATE OR REPLACE TRIGGER "sessions_enqueue_club_push" AFTER INSERT ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_club_session_push"();



CREATE OR REPLACE TRIGGER "sessions_google_sheets_insert_trigger" AFTER INSERT ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_google_sheets_session_insert"();



CREATE OR REPLACE TRIGGER "sessions_google_sheets_update_trigger" AFTER UPDATE OF "name", "date", "start_time", "duration_minutes", "max_players", "arena_count", "session_type", "visibility", "status", "game_options", "confirmed_game_id", "invite_code", "notes", "booking_type", "ticket_type", "ticket_player_count", "ticket_unit_price", "ticket_total_price", "ticket_status", "ticket_reference", "ticket_customer_id", "owner_id" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_google_sheets_session_update"();



CREATE OR REPLACE TRIGGER "sessions_protect_client_update" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."protect_session_client_update"();



CREATE OR REPLACE TRIGGER "sessions_protect_ticket_boundary" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."protect_ticket_session_boundary"();



CREATE OR REPLACE TRIGGER "sessions_rate_limit_creates" BEFORE INSERT ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."rate_limit_session_creates"();



CREATE OR REPLACE TRIGGER "sessions_set_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_attendance_approvals_touch_updated_at" BEFORE UPDATE ON "public"."staff_attendance_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_attendance_logs_apply_rules_insert" BEFORE INSERT ON "public"."staff_attendance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_apply_rules"();



CREATE OR REPLACE TRIGGER "staff_attendance_logs_apply_rules_update" BEFORE UPDATE OF "shift_id", "clock_in_at", "clock_out_at", "break_minutes", "status" ON "public"."staff_attendance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_apply_rules"();



CREATE OR REPLACE TRIGGER "staff_attendance_logs_touch_updated_at" BEFORE UPDATE ON "public"."staff_attendance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_attendance_settings_touch_updated_at" BEFORE UPDATE ON "public"."staff_attendance_settings" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_check_in_locations_touch_updated_at" BEFORE UPDATE ON "public"."staff_check_in_locations" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_discount_rules_audit" AFTER INSERT OR UPDATE ON "public"."staff_discount_rules" FOR EACH ROW EXECUTE FUNCTION "public"."staff_audit_trigger"();



CREATE OR REPLACE TRIGGER "staff_discount_rules_rate_limit_config_writes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_discount_rules" FOR EACH ROW EXECUTE FUNCTION "public"."rate_limit_staff_config_write"();



CREATE OR REPLACE TRIGGER "staff_discount_rules_set_updated_at" BEFORE UPDATE ON "public"."staff_discount_rules" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_employee_profiles_touch_updated_at" BEFORE UPDATE ON "public"."staff_employee_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_games_audit" AFTER INSERT OR UPDATE ON "public"."staff_games" FOR EACH ROW EXECUTE FUNCTION "public"."staff_audit_trigger"();



CREATE OR REPLACE TRIGGER "staff_games_rate_limit_config_writes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_games" FOR EACH ROW EXECUTE FUNCTION "public"."rate_limit_staff_config_write"();



CREATE OR REPLACE TRIGGER "staff_games_set_updated_at" BEFORE UPDATE ON "public"."staff_games" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_hr_adjustments_touch_updated_at" BEFORE UPDATE ON "public"."staff_hr_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_hr_settings_capture_policy_version" BEFORE INSERT OR UPDATE ON "public"."staff_hr_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_staff_hr_policy_version"();



CREATE OR REPLACE TRIGGER "staff_hr_settings_touch_updated_at" BEFORE UPDATE ON "public"."staff_hr_settings" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_hr_setup_options_touch_updated_at" BEFORE UPDATE ON "public"."staff_hr_setup_options" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_session_participants" AFTER INSERT OR DELETE OR UPDATE ON "public"."session_participants" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_sessions" AFTER INSERT OR DELETE OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_attendance_logs" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_attendance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_cost_assignments" AFTER INSERT OR UPDATE ON "public"."staff_cost_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_employee_profiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_employee_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_hr_adjustments" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_hr_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_leave_requests" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_payroll_runs" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_kiosk_audit_staff_schedule_shifts" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_schedule_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."staff_kiosk_audit_mutation"();



CREATE OR REPLACE TRIGGER "staff_leave_requests_touch_updated_at" BEFORE UPDATE ON "public"."staff_leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_loyalty_rules_audit" AFTER INSERT OR UPDATE ON "public"."staff_loyalty_rules" FOR EACH ROW EXECUTE FUNCTION "public"."staff_loyalty_audit_trigger"();



CREATE OR REPLACE TRIGGER "staff_loyalty_rules_rate_limit_config_writes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_loyalty_rules" FOR EACH ROW EXECUTE FUNCTION "public"."rate_limit_staff_config_write"();



CREATE OR REPLACE TRIGGER "staff_loyalty_rules_set_updated_at" BEFORE UPDATE ON "public"."staff_loyalty_rules" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_loyalty_rules_single_active" BEFORE INSERT OR UPDATE OF "active" ON "public"."staff_loyalty_rules" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_active_loyalty_rule"();



CREATE OR REPLACE TRIGGER "staff_order_payments_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_order_payments" FOR EACH ROW EXECUTE FUNCTION "public"."staff_audit_trigger"();



CREATE OR REPLACE TRIGGER "staff_orders_audit" AFTER INSERT OR UPDATE ON "public"."staff_orders" FOR EACH ROW EXECUTE FUNCTION "public"."staff_audit_trigger"();



CREATE OR REPLACE TRIGGER "staff_orders_loyalty_award" AFTER INSERT OR UPDATE OF "payment_status" ON "public"."staff_orders" FOR EACH ROW EXECUTE FUNCTION "public"."staff_order_loyalty_award_trigger"();



CREATE OR REPLACE TRIGGER "staff_orders_set_order_number" BEFORE INSERT ON "public"."staff_orders" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_order_number"();



CREATE OR REPLACE TRIGGER "staff_orders_set_updated_at" BEFORE UPDATE ON "public"."staff_orders" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_payroll_items_apply_probation_bonus" BEFORE INSERT OR UPDATE OF "bonuses_vnd", "payroll_run_id", "profile_id" ON "public"."staff_payroll_items" FOR EACH ROW EXECUTE FUNCTION "public"."apply_staff_probation_bonus_percentage"();



CREATE OR REPLACE TRIGGER "staff_payroll_items_enforce_compliance" BEFORE INSERT OR UPDATE OF "gross_income_vnd", "deductions_vnd", "advances_vnd", "payroll_run_id", "profile_id" ON "public"."staff_payroll_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_staff_payroll_compliance"();



CREATE OR REPLACE TRIGGER "staff_payroll_items_touch_updated_at" BEFORE UPDATE ON "public"."staff_payroll_items" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_payroll_runs_touch_updated_at" BEFORE UPDATE ON "public"."staff_payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_pricing_rules_audit" AFTER INSERT OR UPDATE ON "public"."staff_pricing_rules" FOR EACH ROW EXECUTE FUNCTION "public"."staff_audit_trigger"();



CREATE OR REPLACE TRIGGER "staff_pricing_rules_rate_limit_config_writes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_pricing_rules" FOR EACH ROW EXECUTE FUNCTION "public"."rate_limit_staff_config_write"();



CREATE OR REPLACE TRIGGER "staff_pricing_rules_set_updated_at" BEFORE UPDATE ON "public"."staff_pricing_rules" FOR EACH ROW EXECUTE FUNCTION "public"."staff_set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_schedule_shifts_touch_updated_at" BEFORE UPDATE ON "public"."staff_schedule_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_zalo_identities_touch_updated_at" BEFORE UPDATE ON "public"."staff_zalo_identities" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "staff_zalo_settings_touch_updated_at" BEFORE UPDATE ON "public"."staff_zalo_settings" FOR EACH ROW EXECUTE FUNCTION "public"."staff_attendance_touch_updated_at"();



CREATE OR REPLACE TRIGGER "stamp_staff_cost_assignment" BEFORE INSERT OR UPDATE ON "public"."staff_cost_assignments" FOR EACH ROW EXECUTE FUNCTION "private"."stamp_staff_cost_assignment"();



CREATE OR REPLACE TRIGGER "venue_game_results_validate_check_in" AFTER INSERT ON "public"."venue_game_results" FOR EACH ROW EXECUTE FUNCTION "public"."validate_matched_venue_result_check_in"();



ALTER TABLE ONLY "private"."staff_kiosk_operator_sessions"
    ADD CONSTRAINT "staff_kiosk_operator_sessions_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."staff_kiosk_operator_sessions"
    ADD CONSTRAINT "staff_kiosk_operator_sessions_operator_profile_id_fkey" FOREIGN KEY ("operator_profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."staff_kiosk_pin_attempts"
    ADD CONSTRAINT "staff_kiosk_pin_attempts_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."staff_kiosk_pin_credentials"
    ADD CONSTRAINT "staff_kiosk_pin_credentials_configured_by_fkey" FOREIGN KEY ("configured_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "private"."staff_kiosk_pin_credentials"
    ADD CONSTRAINT "staff_kiosk_pin_credentials_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_analytics_events"
    ADD CONSTRAINT "app_analytics_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_messages"
    ADD CONSTRAINT "club_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_messages"
    ADD CONSTRAINT "club_messages_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_messages"
    ADD CONSTRAINT "club_messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_transactions"
    ADD CONSTRAINT "loyalty_point_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_point_transactions"
    ADD CONSTRAINT "loyalty_point_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_transactions"
    ADD CONSTRAINT "loyalty_point_transactions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."staff_loyalty_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_list"
    ADD CONSTRAINT "marketing_list_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_stat_overrides"
    ADD CONSTRAINT "player_stat_overrides_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_stat_overrides"
    ADD CONSTRAINT "player_stat_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."player_zalo_handoffs"
    ADD CONSTRAINT "player_zalo_handoffs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_zalo_identities"
    ADD CONSTRAINT "player_zalo_identities_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_achievement_awards"
    ADD CONSTRAINT "profile_achievement_awards_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_achievement_awards"
    ADD CONSTRAINT "profile_achievement_awards_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_achievement_awards"
    ADD CONSTRAINT "profile_achievement_awards_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_achievement_unlock_views"
    ADD CONSTRAINT "profile_achievement_unlock_views_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_events"
    ADD CONSTRAINT "push_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_events"
    ADD CONSTRAINT "push_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_messages"
    ADD CONSTRAINT "session_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_messages"
    ADD CONSTRAINT "session_messages_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_messages"
    ADD CONSTRAINT "session_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_times_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_times_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_times_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_times_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_participant_chapter_times"
    ADD CONSTRAINT "session_participant_chapter_times_staff_game_id_fkey" FOREIGN KEY ("staff_game_id") REFERENCES "public"."staff_games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_participants"
    ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_waitlist"
    ADD CONSTRAINT "session_waitlist_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_challenge_target_id_fkey" FOREIGN KEY ("challenge_target_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_ticket_customer_id_fkey" FOREIGN KEY ("ticket_customer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_ticket_discount_rule_id_fkey" FOREIGN KEY ("ticket_discount_rule_id") REFERENCES "public"."staff_discount_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_approvals"
    ADD CONSTRAINT "staff_attendance_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_clock_in_location_id_fkey" FOREIGN KEY ("clock_in_location_id") REFERENCES "public"."staff_check_in_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_clock_out_location_id_fkey" FOREIGN KEY ("clock_out_location_id") REFERENCES "public"."staff_check_in_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."staff_schedule_shifts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_attendance_settings"
    ADD CONSTRAINT "staff_attendance_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_check_in_locations"
    ADD CONSTRAINT "staff_check_in_locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_check_in_locations"
    ADD CONSTRAINT "staff_check_in_locations_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_check_in_locations"
    ADD CONSTRAINT "staff_check_in_locations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_cost_assignments"
    ADD CONSTRAINT "staff_cost_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id");



ALTER TABLE ONLY "public"."staff_discount_rules"
    ADD CONSTRAINT "staff_discount_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_discount_rules"
    ADD CONSTRAINT "staff_discount_rules_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."staff_games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_discount_rules"
    ADD CONSTRAINT "staff_discount_rules_price_rule_id_fkey" FOREIGN KEY ("price_rule_id") REFERENCES "public"."staff_pricing_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_employee_profiles"
    ADD CONSTRAINT "staff_employee_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_employee_profiles"
    ADD CONSTRAINT "staff_employee_profiles_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_games"
    ADD CONSTRAINT "staff_games_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_adjustments"
    ADD CONSTRAINT "staff_hr_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_adjustments"
    ADD CONSTRAINT "staff_hr_adjustments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_adjustments"
    ADD CONSTRAINT "staff_hr_adjustments_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."staff_payroll_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_adjustments"
    ADD CONSTRAINT "staff_hr_adjustments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_hr_adjustments"
    ADD CONSTRAINT "staff_hr_adjustments_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_documents"
    ADD CONSTRAINT "staff_hr_documents_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_documents"
    ADD CONSTRAINT "staff_hr_documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_hr_documents"
    ADD CONSTRAINT "staff_hr_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_policy_versions"
    ADD CONSTRAINT "staff_hr_policy_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_settings"
    ADD CONSTRAINT "staff_hr_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_setup_options"
    ADD CONSTRAINT "staff_hr_setup_options_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_hr_setup_options"
    ADD CONSTRAINT "staff_hr_setup_options_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_leave_requests"
    ADD CONSTRAINT "staff_leave_requests_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_leave_requests"
    ADD CONSTRAINT "staff_leave_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_leave_requests"
    ADD CONSTRAINT "staff_leave_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_leave_requests"
    ADD CONSTRAINT "staff_leave_requests_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_loyalty_rules"
    ADD CONSTRAINT "staff_loyalty_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_loyalty_rules"
    ADD CONSTRAINT "staff_loyalty_rules_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."staff_games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_order_payments"
    ADD CONSTRAINT "staff_order_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_order_payments"
    ADD CONSTRAINT "staff_order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."staff_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_discount_rule_id_fkey" FOREIGN KEY ("discount_rule_id") REFERENCES "public"."staff_discount_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."staff_games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_orders"
    ADD CONSTRAINT "staff_orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_payroll_items"
    ADD CONSTRAINT "staff_payroll_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_payroll_items"
    ADD CONSTRAINT "staff_payroll_items_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."staff_payroll_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_payroll_items"
    ADD CONSTRAINT "staff_payroll_items_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_payroll_runs"
    ADD CONSTRAINT "staff_payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_payroll_runs"
    ADD CONSTRAINT "staff_payroll_runs_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_payroll_runs"
    ADD CONSTRAINT "staff_payroll_runs_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_pricing_rules"
    ADD CONSTRAINT "staff_pricing_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_pricing_rules"
    ADD CONSTRAINT "staff_pricing_rules_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."staff_games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_schedule_shifts"
    ADD CONSTRAINT "staff_schedule_shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_schedule_shifts"
    ADD CONSTRAINT "staff_schedule_shifts_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_schedule_shifts"
    ADD CONSTRAINT "staff_schedule_shifts_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_zalo_attendance_events"
    ADD CONSTRAINT "staff_zalo_attendance_events_attendance_log_id_fkey" FOREIGN KEY ("attendance_log_id") REFERENCES "public"."staff_attendance_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_zalo_attendance_events"
    ADD CONSTRAINT "staff_zalo_attendance_events_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "public"."staff_zalo_identities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_zalo_attendance_events"
    ADD CONSTRAINT "staff_zalo_attendance_events_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_zalo_identities"
    ADD CONSTRAINT "staff_zalo_identities_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_zalo_identities"
    ADD CONSTRAINT "staff_zalo_identities_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_employee_profiles"("profile_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_zalo_settings"
    ADD CONSTRAINT "staff_zalo_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_audit_log"
    ADD CONSTRAINT "tournament_audit_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_audit_log"
    ADD CONSTRAINT "tournament_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_editors"
    ADD CONSTRAINT "tournament_editors_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_editors"
    ADD CONSTRAINT "tournament_editors_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_loser_participant_id_fkey" FOREIGN KEY ("loser_participant_id") REFERENCES "public"."session_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "public"."session_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "public"."session_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."tournament_pools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "public"."tournament_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "public"."tournament_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_winner_participant_id_fkey" FOREIGN KEY ("winner_participant_id") REFERENCES "public"."session_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "public"."tournament_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_pool_entries"
    ADD CONSTRAINT "tournament_pool_entries_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_pool_entries"
    ADD CONSTRAINT "tournament_pool_entries_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."tournament_pools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_pool_entries"
    ADD CONSTRAINT "tournament_pool_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_pool_entries"
    ADD CONSTRAINT "tournament_pool_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_pools"
    ADD CONSTRAINT "tournament_pools_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_team_members"
    ADD CONSTRAINT "tournament_team_members_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_team_members"
    ADD CONSTRAINT "tournament_team_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_team_members"
    ADD CONSTRAINT "tournament_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."tournament_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_teams"
    ADD CONSTRAINT "tournament_teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_teams"
    ADD CONSTRAINT "tournament_teams_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_game_results"
    ADD CONSTRAINT "venue_game_results_matched_participant_id_fkey" FOREIGN KEY ("matched_participant_id") REFERENCES "public"."session_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_game_results"
    ADD CONSTRAINT "venue_game_results_matched_session_id_fkey" FOREIGN KEY ("matched_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_game_results"
    ADD CONSTRAINT "venue_game_results_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."venue_result_reviews"
    ADD CONSTRAINT "venue_result_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_support_bundle_download_tokens"
    ADD CONSTRAINT "venue_support_bundle_download_tokens_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "public"."venue_support_bundles"("id") ON DELETE CASCADE;



CREATE POLICY "integration settings deny browser access" ON "private"."integration_settings" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "private"."integration_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins create blocked times" ON "public"."blocked_times" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins delete blocked times" ON "public"."blocked_times" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage pricing rules" ON "public"."pricing_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins update blocked times" ON "public"."blocked_times" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Blocked times are visible" ON "public"."blocked_times" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Club creators approve members" ON "public"."club_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND (("c"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))))))));



CREATE POLICY "Club creators delete clubs" ON "public"."clubs" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "Club creators update clubs" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "Clubs are visible to authenticated users" ON "public"."clubs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "HR administrators cancel cost assignments" ON "public"."staff_cost_assignments" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") AND (NOT COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false)) AND ("cancelled_at" IS NULL))) WITH CHECK ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") AND (NOT COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false)) AND ("cancelled_at" IS NOT NULL) AND ("cancelled_by" = ( SELECT "public"."current_staff_actor_profile_id"() AS "current_staff_actor_profile_id"))));



CREATE POLICY "HR administrators create cost assignments" ON "public"."staff_cost_assignments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") AND (NOT COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false)) AND ("created_by" = ( SELECT "public"."current_staff_actor_profile_id"() AS "current_staff_actor_profile_id")) AND ("cancelled_at" IS NULL) AND ("cancelled_by" IS NULL)));



CREATE POLICY "HR administrators read cost assignments" ON "public"."staff_cost_assignments" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") AND (NOT COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false))));



CREATE POLICY "Pricing rules are visible" ON "public"."pricing_rules" FOR SELECT TO "authenticated" USING (("active" = true));



CREATE POLICY "Public can read active vouchers" ON "public"."vouchers" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "Staff can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("public"."current_staff_role_rank"() >= 20) AND ("deleted_at" IS NULL)));



CREATE POLICY "Tournament data is readable" ON "public"."tournament_pools" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Tournament editors are readable" ON "public"."tournament_editors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Tournament editors host insert" ON "public"."tournament_editors" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "tournament_editors"."session_id") AND ("s"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Tournament editors visible" ON "public"."tournament_editors" FOR SELECT USING (true);



CREATE POLICY "Tournament entries are readable" ON "public"."tournament_pool_entries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Tournament managers read audit history" ON "public"."tournament_audit_log" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)) AND "private"."can_manage_tournament"("session_id")));



CREATE POLICY "Tournament managers write entries" ON "public"."tournament_pool_entries" TO "authenticated" USING ("private"."can_manage_tournament"("session_id")) WITH CHECK ("private"."can_manage_tournament"("session_id"));



CREATE POLICY "Tournament managers write matches" ON "public"."tournament_matches" TO "authenticated" USING ("private"."can_manage_tournament"("session_id")) WITH CHECK ("private"."can_manage_tournament"("session_id"));



CREATE POLICY "Tournament managers write pools" ON "public"."tournament_pools" TO "authenticated" USING ("private"."can_manage_tournament"("session_id")) WITH CHECK ("private"."can_manage_tournament"("session_id"));



CREATE POLICY "Tournament managers write team members" ON "public"."tournament_team_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tournament_teams" "tt"
  WHERE (("tt"."id" = "tournament_team_members"."team_id") AND "private"."can_manage_tournament"("tt"."session_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournament_teams" "tt"
  WHERE (("tt"."id" = "tournament_team_members"."team_id") AND "private"."can_manage_tournament"("tt"."session_id")))));



CREATE POLICY "Tournament managers write teams" ON "public"."tournament_teams" TO "authenticated" USING ("private"."can_manage_tournament"("session_id")) WITH CHECK ("private"."can_manage_tournament"("session_id"));



CREATE POLICY "Tournament matches are readable" ON "public"."tournament_matches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Tournament owners manage editors" ON "public"."tournament_editors" TO "authenticated" USING ("private"."owns_tournament"("session_id")) WITH CHECK ("private"."owns_tournament"("session_id"));



CREATE POLICY "Tournament team members are readable" ON "public"."tournament_team_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Tournament teams are readable" ON "public"."tournament_teams" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") AND ("deleted_at" IS NULL))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users create clubs" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users join or request clubs" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "profile_id") AND ((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND ("c"."visibility" = 'public'::"text") AND ("club_members"."status" = 'approved'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND ("c"."visibility" = 'private'::"text") AND ("club_members"."status" = 'pending'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND ("c"."owner_id" = "auth"."uid"()) AND ("club_members"."status" = 'approved'::"text")))))));



CREATE POLICY "Users or club creators remove club members" ON "public"."club_members" FOR DELETE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND (("c"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))))))));



CREATE POLICY "Visible club members can be read" ON "public"."club_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."owner_id" = "auth"."uid"()) OR ("club_members"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "aal2 admins read session messages" ON "public"."session_messages" FOR SELECT TO "authenticated" USING ((COALESCE(( SELECT "public"."current_staff_role_rank"() AS "current_staff_role_rank"), 0) >= 100));



CREATE POLICY "admins delete session messages" ON "public"."session_messages" FOR DELETE TO "authenticated" USING ((COALESCE(( SELECT "public"."current_staff_role_rank"() AS "current_staff_role_rank"), 0) >= 100));



CREATE POLICY "admins read marketing list" ON "public"."marketing_list" FOR SELECT TO "authenticated" USING ("private"."is_vrena_admin"());



ALTER TABLE "public"."app_analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authors delete own messages" ON "public"."session_messages" FOR DELETE USING (("auth"."uid"() = "author_id"));



ALTER TABLE "public"."blocked_times" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings deny browser access" ON "public"."bookings" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "chapter times select own or staff" ON "public"."session_participant_chapter_times" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "private"."is_staff_console_user"(20)));



CREATE POLICY "chapter times staff delete" ON "public"."session_participant_chapter_times" FOR DELETE TO "authenticated" USING ("private"."is_staff_console_user"(50));



CREATE POLICY "chapter times staff insert" ON "public"."session_participant_chapter_times" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "chapter times staff update" ON "public"."session_participant_chapter_times" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(50)) WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "club member roles managed by authorized roles" ON "public"."club_members" FOR UPDATE TO "authenticated" USING ("private"."can_manage_club_member"("club_id", "profile_id", "role")) WITH CHECK ("private"."can_manage_club_member"("club_id", "profile_id", "role"));



CREATE POLICY "club members create club messages" ON "public"."club_messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "author_id") AND ("deleted_at" IS NULL) AND ("message_type" = ANY (ARRAY['public'::"text", 'admin_private'::"text"])) AND (("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 150)) AND "private"."can_use_club_messages"("club_id")));



CREATE POLICY "club members readable by allowed users" ON "public"."club_members" FOR SELECT TO "authenticated" USING ("private"."can_read_club_member_row"("club_id", "profile_id"));



CREATE POLICY "club members removed by authorized roles" ON "public"."club_members" FOR DELETE TO "authenticated" USING ("private"."can_manage_club_member"("club_id", "profile_id", "role"));



CREATE POLICY "club messages are readable by club members" ON "public"."club_messages" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND ((("message_type" = 'public'::"text") AND "private"."can_use_club_messages"("club_id")) OR (("message_type" = 'admin_private'::"text") AND (("author_id" = "auth"."uid"()) OR "private"."can_manage_club_settings"("club_id"))))));



CREATE POLICY "club messages soft deleted by authors or admins" ON "public"."club_messages" FOR UPDATE TO "authenticated" USING ((("deleted_at" IS NULL) AND (("author_id" = "auth"."uid"()) OR "private"."can_manage_club_settings"("club_id")))) WITH CHECK ((("author_id" = "auth"."uid"()) OR "private"."can_manage_club_settings"("club_id")));



CREATE POLICY "club settings editable by authorized club roles" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ("private"."can_manage_club_settings"("id")) WITH CHECK ("private"."can_manage_club_settings"("id"));



ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows are readable" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "invite owners can delete invites" ON "public"."session_invites" FOR DELETE TO "authenticated" USING ((("inviter_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."can_manage_session_row"("session_id")));



CREATE POLICY "invited users update their invites" ON "public"."session_invites" FOR UPDATE TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "loyalty transactions own read" ON "public"."loyalty_point_transactions" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."is_staff_console_user"(20)));



CREATE POLICY "loyalty transactions staff insert" ON "public"."loyalty_point_transactions" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(50));



ALTER TABLE "public"."loyalty_point_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_list" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message translations deny browser access" ON "public"."message_translations" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."message_translations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own achievement awards select" ON "public"."profile_achievement_awards" FOR SELECT TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own achievement unlock views insert" ON "public"."profile_achievement_unlock_views" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own achievement unlock views select" ON "public"."profile_achievement_unlock_views" FOR SELECT TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own achievement unlock views update" ON "public"."profile_achievement_unlock_views" FOR UPDATE TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "participants update session votes" ON "public"."sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."session_participants" "sp"
  WHERE (("sp"."session_id" = "sessions"."id") AND ("sp"."profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sp"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."session_participants" "sp"
  WHERE (("sp"."session_id" = "sessions"."id") AND ("sp"."profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sp"."deleted_at" IS NULL)))));



CREATE POLICY "permanent accounts only" ON "public"."audit_logs" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."blocked_times" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."club_members" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."club_messages" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."clubs" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."loyalty_point_transactions" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."marketing_list" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."pricing_rules" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."profile_achievement_awards" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."profile_achievement_unlock_views" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."profiles" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."push_events" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."push_subscriptions" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."session_invites" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."session_messages" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."session_participant_chapter_times" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."session_participants" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."session_waitlist" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."sessions" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_attendance_approvals" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_attendance_logs" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_attendance_settings" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_check_in_locations" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_discount_rules" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_employee_profiles" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_games" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_hr_adjustments" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_hr_documents" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_hr_settings" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_hr_setup_options" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_leave_requests" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_loyalty_rules" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_order_payments" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_orders" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_payroll_items" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_payroll_runs" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_pricing_rules" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_schedule_shifts" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."staff_zalo_settings" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."tournament_editors" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."tournament_matches" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."tournament_pool_entries" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."tournament_pools" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."tournament_team_members" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."tournament_teams" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



CREATE POLICY "permanent accounts only" ON "public"."user_follows" AS RESTRICTIVE TO "authenticated" USING ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false))) WITH CHECK ((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)));



ALTER TABLE "public"."player_stat_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_zalo_handoffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_zalo_handoffs_deny_browser_access" ON "public"."player_zalo_handoffs" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



COMMENT ON POLICY "player_zalo_handoffs_deny_browser_access" ON "public"."player_zalo_handoffs" IS 'Handoff tokens are intentionally service-role only; browser roles receive no table grants.';



ALTER TABLE "public"."player_zalo_identities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_zalo_identities_deny_browser_access" ON "public"."player_zalo_identities" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



COMMENT ON POLICY "player_zalo_identities_deny_browser_access" ON "public"."player_zalo_identities" IS 'Identity mappings are intentionally service-role only; browser roles receive no table grants.';



ALTER TABLE "public"."pricing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_achievement_awards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_achievement_unlock_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "security rate limits deny browser access" ON "public"."security_rate_limits" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."security_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session creators and admins review messages" ON "public"."session_messages" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_messages"."session_id") AND ("sessions"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (COALESCE(( SELECT "public"."current_staff_role_rank"() AS "current_staff_role_rank"), 0) >= 100))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_messages"."session_id") AND ("sessions"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (COALESCE(( SELECT "public"."current_staff_role_rank"() AS "current_staff_role_rank"), 0) >= 100)));



CREATE POLICY "session invites readable by related users" ON "public"."session_invites" FOR SELECT TO "authenticated" USING ((("inviter_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."can_manage_session_row"("session_id")));



CREATE POLICY "session managers update participant results" ON "public"."session_participants" FOR UPDATE TO "authenticated" USING ((("deleted_at" IS NULL) AND "private"."can_manage_session_row"("session_id"))) WITH CHECK ((("deleted_at" IS NULL) AND "private"."can_manage_session_row"("session_id")));



CREATE POLICY "session managers update sessions" ON "public"."sessions" FOR UPDATE TO "authenticated" USING ("private"."can_manage_session_row"("id")) WITH CHECK ("private"."can_manage_session_row"("id"));



CREATE POLICY "session messages are readable" ON "public"."session_messages" FOR SELECT USING ((("moderation_status" = 'approved'::"text") OR ("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_messages"."session_id") AND ("sessions"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "session participants readable by related users" ON "public"."session_participants" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND (("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."can_manage_session_row"("session_id"))));



ALTER TABLE "public"."session_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_participant_chapter_times" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions readable by allowed users" ON "public"."sessions" FOR SELECT TO "authenticated" USING ("private"."can_view_session_row"("id"));



CREATE POLICY "staff Zalo attendance events deny browser access" ON "public"."staff_zalo_attendance_events" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "staff Zalo identities deny browser access" ON "public"."staff_zalo_identities" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "staff achievement awards select" ON "public"."profile_achievement_awards" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(50));



CREATE POLICY "staff admins update profile roles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("private"."is_vrena_admin"() AND (("lower"(COALESCE("role", ''::"text")) <> 'owner'::"text") OR "private"."is_vrena_owner"()))) WITH CHECK (("private"."is_vrena_admin"() AND (("lower"(COALESCE("role", ''::"text")) <> 'owner'::"text") OR "private"."is_vrena_owner"())));



CREATE POLICY "staff attendance approvals read" ON "public"."staff_attendance_approvals" FOR SELECT TO "authenticated" USING (("public"."current_staff_role_rank"() >= 20));



CREATE POLICY "staff attendance logs manage" ON "public"."staff_attendance_logs" TO "authenticated" USING (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor")) WITH CHECK (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor"));



CREATE POLICY "staff attendance logs read" ON "public"."staff_attendance_logs" FOR SELECT TO "authenticated" USING (( SELECT "private"."can_read_staff_attendance_row"("staff_attendance_logs"."staff_profile_id") AS "can_read_staff_attendance_row"));



CREATE POLICY "staff attendance settings manage" ON "public"."staff_attendance_settings" TO "authenticated" USING (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor")) WITH CHECK (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor"));



CREATE POLICY "staff attendance settings read" ON "public"."staff_attendance_settings" FOR SELECT TO "authenticated" USING (( SELECT "private"."can_read_staff_attendance_settings"() AS "can_read_staff_attendance_settings"));



CREATE POLICY "staff audit insert" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff audit select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff check in locations manage" ON "public"."staff_check_in_locations" TO "authenticated" USING (("public"."current_staff_role_rank"() >= 100)) WITH CHECK (("public"."current_staff_role_rank"() >= 100));



CREATE POLICY "staff discounts insert" ON "public"."staff_discount_rules" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff discounts select" ON "public"."staff_discount_rules" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff discounts update" ON "public"."staff_discount_rules" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(50)) WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff employee profiles manage" ON "public"."staff_employee_profiles" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff employee profiles read" ON "public"."staff_employee_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") OR ("profile_id" = ( SELECT "public"."current_staff_actor_profile_id"() AS "current_staff_actor_profile_id"))));



CREATE POLICY "staff games active public select" ON "public"."staff_games" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "staff games insert" ON "public"."staff_games" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(80));



CREATE POLICY "staff games select" ON "public"."staff_games" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff games update" ON "public"."staff_games" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(80)) WITH CHECK ("private"."is_staff_console_user"(80));



CREATE POLICY "staff hr adjustments manage" ON "public"."staff_hr_adjustments" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff hr adjustments read" ON "public"."staff_hr_adjustments" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") OR ("profile_id" = ( SELECT "public"."current_staff_actor_profile_id"() AS "current_staff_actor_profile_id"))));



CREATE POLICY "staff hr documents manage" ON "public"."staff_hr_documents" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff hr documents read" ON "public"."staff_hr_documents" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") OR ("profile_id" = ( SELECT "public"."current_staff_actor_profile_id"() AS "current_staff_actor_profile_id"))));



CREATE POLICY "staff hr policy read" ON "public"."staff_hr_policy_versions" FOR SELECT TO "authenticated" USING (((NOT COALESCE(( SELECT (("auth"."jwt"() ->> 'is_anonymous'::"text"))::boolean AS "bool"), false)) AND ( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor")));



CREATE POLICY "staff hr settings manage" ON "public"."staff_hr_settings" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff hr settings read" ON "public"."staff_hr_settings" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff hr setup manage" ON "public"."staff_hr_setup_options" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff hr setup read" ON "public"."staff_hr_setup_options" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff leave manage" ON "public"."staff_leave_requests" TO "authenticated" USING (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor")) WITH CHECK (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor"));



CREATE POLICY "staff leave read" ON "public"."staff_leave_requests" FOR SELECT TO "authenticated" USING (( SELECT "private"."can_read_staff_attendance_row"("staff_leave_requests"."staff_profile_id") AS "can_read_staff_attendance_row"));



CREATE POLICY "staff loyalty insert" ON "public"."staff_loyalty_rules" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(80));



CREATE POLICY "staff loyalty select" ON "public"."staff_loyalty_rules" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff loyalty update" ON "public"."staff_loyalty_rules" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(80)) WITH CHECK ("private"."is_staff_console_user"(80));



CREATE POLICY "staff order payments delete" ON "public"."staff_order_payments" FOR DELETE TO "authenticated" USING ("private"."is_staff_console_user"(50));



CREATE POLICY "staff order payments insert" ON "public"."staff_order_payments" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff order payments select" ON "public"."staff_order_payments" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff order payments update" ON "public"."staff_order_payments" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(50)) WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff orders insert" ON "public"."staff_orders" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff orders select" ON "public"."staff_orders" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff orders update" ON "public"."staff_orders" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(50)) WITH CHECK ("private"."is_staff_console_user"(50));



CREATE POLICY "staff payroll items manage" ON "public"."staff_payroll_items" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff payroll items read" ON "public"."staff_payroll_items" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator") OR ("profile_id" = ( SELECT "public"."current_staff_actor_profile_id"() AS "current_staff_actor_profile_id"))));



CREATE POLICY "staff payroll runs manage" ON "public"."staff_payroll_runs" TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff payroll runs read" ON "public"."staff_payroll_runs" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff payroll source snapshots delete" ON "public"."staff_payroll_source_snapshots" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff payroll source snapshots insert" ON "public"."staff_payroll_source_snapshots" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff payroll source snapshots read" ON "public"."staff_payroll_source_snapshots" FOR SELECT TO "authenticated" USING (((NOT COALESCE(((( SELECT "auth"."jwt"() AS "jwt") ->> 'is_anonymous'::"text"))::boolean, false)) AND ( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")));



CREATE POLICY "staff payroll source snapshots update" ON "public"."staff_payroll_source_snapshots" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator")) WITH CHECK (( SELECT "private"."is_hr_administrator"() AS "is_hr_administrator"));



CREATE POLICY "staff player stat overrides select" ON "public"."player_stat_overrides" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(50));



CREATE POLICY "staff prices insert" ON "public"."staff_pricing_rules" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff_console_user"(80));



CREATE POLICY "staff prices select" ON "public"."staff_pricing_rules" FOR SELECT TO "authenticated" USING ("private"."is_staff_console_user"(20));



CREATE POLICY "staff prices update" ON "public"."staff_pricing_rules" FOR UPDATE TO "authenticated" USING ("private"."is_staff_console_user"(80)) WITH CHECK ("private"."is_staff_console_user"(80));



CREATE POLICY "staff shifts manage" ON "public"."staff_schedule_shifts" TO "authenticated" USING (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor")) WITH CHECK (( SELECT "private"."is_staff_attendance_editor"() AS "is_staff_attendance_editor"));



CREATE POLICY "staff shifts read" ON "public"."staff_schedule_shifts" FOR SELECT TO "authenticated" USING (( SELECT "private"."can_read_staff_attendance_row"("staff_schedule_shifts"."staff_profile_id") AS "can_read_staff_attendance_row"));



CREATE POLICY "staff zalo settings manage" ON "public"."staff_zalo_settings" TO "authenticated" USING (("public"."current_staff_role_rank"() >= 100)) WITH CHECK (("public"."current_staff_role_rank"() >= 100));



ALTER TABLE "public"."staff_attendance_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_attendance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_attendance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_check_in_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_cost_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_discount_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_employee_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_hr_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_hr_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_hr_policy_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_hr_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_hr_setup_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_loyalty_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_order_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_payroll_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_payroll_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_payroll_source_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_pricing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_schedule_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_zalo_attendance_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_zalo_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_zalo_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_editors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_pool_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_pools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can join their own waitlist" ON "public"."session_waitlist" FOR INSERT TO "authenticated" WITH CHECK ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_waitlist"."session_id") AND ("s"."deleted_at" IS NULL) AND ("s"."status" = 'open'::"text") AND (("s"."visibility" = 'public'::"text") OR ("s"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."session_invites" "si"
          WHERE (("si"."session_id" = "s"."id") AND ("si"."recipient_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



CREATE POLICY "users can leave their own waitlist" ON "public"."session_waitlist" FOR DELETE TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."can_manage_session_row"("session_id")));



CREATE POLICY "users create own community sessions" ON "public"."sessions" FOR INSERT TO "authenticated" WITH CHECK ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND (NOT COALESCE((( SELECT ("auth"."jwt"() ->> 'is_anonymous'::"text")))::boolean, false)) AND ("deleted_at" IS NULL) AND ("status" = 'open'::"text") AND ("booking_type" = 'community'::"text") AND ("ticket_type" IS NULL) AND ("ticket_player_count" IS NULL) AND ("ticket_total_price" IS NULL) AND ("ticket_unit_price" IS NULL) AND ("ticket_status" IS NULL) AND ("ticket_reference" IS NULL) AND ("ticket_customer_id" IS NULL) AND ("challenge_target_id" IS NULL) AND ("challenge_status" IS NULL) AND ("challenge_accepted_at" IS NULL) AND ("challenge_declined_at" IS NULL) AND (("club_id" IS NULL) OR (COALESCE("public"."current_staff_role_rank"(), 0) >= 50) OR (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "sessions"."club_id") AND ("c"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "sessions"."club_id") AND ("cm"."profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cm"."status" = 'approved'::"text") AND ("cm"."deleted_at" IS NULL)))))));



CREATE POLICY "users create own invites" ON "public"."session_invites" FOR INSERT TO "authenticated" WITH CHECK ((("inviter_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("private"."can_manage_session_row"("session_id") OR (EXISTS ( SELECT 1
   FROM "public"."session_participants" "sp"
  WHERE (("sp"."session_id" = "session_invites"."session_id") AND ("sp"."profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sp"."deleted_at" IS NULL)))))));



CREATE POLICY "users create own push subscriptions" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (("lower"("endpoint") ~ '^https://fcm[.]googleapis[.]com/'::"text") OR ("lower"("endpoint") ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'::"text") OR ("lower"("endpoint") ~ '^https://web[.]push[.]apple[.]com/'::"text") OR ("lower"("endpoint") ~ '^https://([a-z0-9-]+[.])*notify[.]windows[.]com/'::"text"))));



CREATE POLICY "users delete own push subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "users insert own club membership rows" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ((("deleted_at" IS NULL) AND "private"."can_insert_club_member_row"("club_id", "profile_id", "status")));



CREATE POLICY "users join allowed sessions as themselves" ON "public"."session_participants" FOR INSERT TO "authenticated" WITH CHECK ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL) AND "private"."can_join_session_row"("session_id")));



CREATE POLICY "users manage own follows" ON "public"."user_follows" USING (("auth"."uid"() = "follower_id")) WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "users manage own marketing consent row" ON "public"."marketing_list" USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "users read own push events" ON "public"."push_events" FOR SELECT USING (("auth"."uid"() = "recipient_id"));



CREATE POLICY "users read own push subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "users update own push subscriptions" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id")) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (("lower"("endpoint") ~ '^https://fcm[.]googleapis[.]com/'::"text") OR ("lower"("endpoint") ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'::"text") OR ("lower"("endpoint") ~ '^https://web[.]push[.]apple[.]com/'::"text") OR ("lower"("endpoint") ~ '^https://([a-z0-9-]+[.])*notify[.]windows[.]com/'::"text"))));



CREATE POLICY "venue result reviews service only" ON "public"."venue_result_reviews" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "venue results visible to player or session viewers" ON "public"."venue_game_results" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("matched_session_id" IS NOT NULL) AND "public"."can_view_session_row"("matched_session_id"))));



CREATE POLICY "venue support bundles service only" ON "public"."venue_support_bundles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "venue support download tokens service only" ON "public"."venue_support_bundle_download_tokens" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."venue_game_result_duplicate_archive" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_game_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_result_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_support_bundle_download_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_support_bundles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vouchers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist readable by allowed users" ON "public"."session_waitlist" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."can_manage_session_row"("session_id")));



CREATE POLICY "zalo webhook receipts service only" ON "public"."zalo_webhook_receipts" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."zalo_webhook_receipts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "private" TO "service_role";
GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_join_session_row"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_join_session_row"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_join_session_row"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_avatar_object_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_avatar_object_path"("p_object_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_avatar_object_path"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_club_banner_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_club_banner_path"("p_object_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_club_banner_path"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_club_settings"("p_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_club_settings"("p_club_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_club_settings"("p_club_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_session_row"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_session_row"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_session_row"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_staff_game_image_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_staff_game_image_path"("p_object_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_staff_game_image_path"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_staff_hr_document_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_staff_hr_document_path"("p_object_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_staff_hr_document_path"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_tournament"("target_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_tournament"("target_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_manage_tournament"("target_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_read_staff_attendance_row"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_staff_attendance_row"("p_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_read_staff_attendance_row"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_read_staff_attendance_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_staff_attendance_settings"() TO "service_role";
GRANT ALL ON FUNCTION "private"."can_read_staff_attendance_settings"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_read_staff_hr_document_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_staff_hr_document_path"("p_object_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_read_staff_hr_document_path"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_use_club_messages"("p_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_use_club_messages"("p_club_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_use_club_messages"("p_club_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_view_session_row"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_view_session_row"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."can_view_session_row"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."current_staff_kiosk_operator_profile_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_staff_kiosk_operator_profile_id"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."current_staff_kiosk_role_key"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_staff_kiosk_role_key"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."current_staff_kiosk_role_rank"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_staff_kiosk_role_rank"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."current_staff_kiosk_session_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_staff_kiosk_session_id"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."delete_profile_after_auth_user"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."enforce_staff_kiosk_department_eligibility"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_duplicate_ticket_booking"("p_venue_key" "text", "p_customer_id" "uuid", "p_guest_phone" "text", "p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer) FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_hr_only_profile_identity"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."is_hr_administrator"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_hr_administrator"() TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_hr_administrator"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."is_staff_attendance_editor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_staff_attendance_editor"() TO "service_role";
GRANT ALL ON FUNCTION "private"."is_staff_attendance_editor"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_staff_console_user"("p_min_rank" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_staff_console_user"("p_min_rank" integer) TO "service_role";
GRANT ALL ON FUNCTION "private"."is_staff_console_user"("p_min_rank" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_vrena_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_vrena_admin"() TO "service_role";
GRANT ALL ON FUNCTION "private"."is_vrena_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_vrena_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_vrena_owner"() TO "service_role";
GRANT ALL ON FUNCTION "private"."is_vrena_owner"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."normalize_profile_optional_contact_fields"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."owns_tournament"("target_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."owns_tournament"("target_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."owns_tournament"("target_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."player_stat_overrides_touch_updated_at"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."player_zalo_touch_updated_at"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."staff_kiosk_department_is_eligible"("p_department" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."staff_kiosk_department_is_eligible"("p_department" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."staff_kiosk_request_headers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."staff_kiosk_request_headers"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."staff_kiosk_request_token_hash"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."staff_kiosk_request_token_hash"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."staff_report_profile_is_excluded"("p_profile_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."stamp_staff_cost_assignment"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."apply_loyalty_points_delta"("p_profile_id" "uuid", "p_points_delta" integer, "p_rule_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_reason" "text", "p_created_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_loyalty_points_delta"("p_profile_id" "uuid", "p_points_delta" integer, "p_rule_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_reason" "text", "p_created_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_staff_probation_bonus_percentage"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_staff_probation_bonus_percentage"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."attribute_staff_kiosk_audit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."attribute_staff_kiosk_audit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_staff_order_loyalty"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_staff_order_loyalty"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_insert_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid", "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_join_session_row"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_join_session_row"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_avatar_object_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_avatar_object_path"("p_object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_club_banner_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_club_banner_path"("p_object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_club_member"("p_club_id" "uuid", "p_target_profile_id" "uuid", "p_target_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_club_settings"("p_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_club_settings"("p_club_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_session_row"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_session_row"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_staff_game_image_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_staff_game_image_path"("p_object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_staff_hr_document_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_staff_hr_document_path"("p_object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_tournament"("target_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_tournament"("target_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_club_member_row"("p_club_id" "uuid", "p_member_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_read_staff_attendance_row"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_staff_attendance_row"("p_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_read_staff_attendance_row"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_read_staff_attendance_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_staff_attendance_settings"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_read_staff_hr_document_path"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_staff_hr_document_path"("p_object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_use_club_messages"("p_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_use_club_messages"("p_club_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_club_private_content"("p_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_club_private_content"("p_club_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_session_row"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_session_row"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_view_session_row"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."capture_staff_hr_policy_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capture_staff_hr_policy_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."claim_ticket_automatic_discount"("p_discount_rule_id" "uuid", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text", "p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_ticket_automatic_discount"("p_discount_rule_id" "uuid", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text", "p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."club_member_role"("p_club_id" "uuid", "p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."club_member_role"("p_club_id" "uuid", "p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."clubs_list_page"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clubs_list_page"() TO "service_role";
GRANT ALL ON FUNCTION "public"."clubs_list_page"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clubs_list_page"() TO "anon";



REVOKE ALL ON FUNCTION "public"."consume_booking_attempt_rate_limit"("p_subject" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_booking_attempt_rate_limit"("p_subject" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."consume_booking_attempt_rate_limit"("p_subject" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_booking_attempt_rate_limit"("p_subject" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."consume_guest_ticket_booking_rate_limit"("p_guest_phone" "text", "p_date" "date", "p_start_time" time without time zone, "p_ticket_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_guest_ticket_booking_rate_limit"("p_guest_phone" "text", "p_date" "date", "p_start_time" time without time zone, "p_ticket_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_login_attempt_rate_limit"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_login_attempt_rate_limit"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_password_reset_rate_limit"("p_email" "text", "p_ip" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_password_reset_rate_limit"("p_email" "text", "p_ip" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_action" "text", "p_limit" integer, "p_window_seconds" integer, "p_subject" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_user_action_rate_limit"("p_action" "text", "p_subject" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_user_action_rate_limit"("p_action" "text", "p_subject" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."consume_user_action_rate_limit"("p_action" "text", "p_subject" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text", "p_guest_name" "text", "p_special_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text", "p_guest_name" "text", "p_special_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text", "p_guest_name" "text", "p_special_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_cafe_ticket_booking_request"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_guest_phone" "text", "p_guest_name" "text", "p_special_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_friend_challenge"("p_target_profile_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_game_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_guest_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_guest_phone" "text", "p_guest_name" "text", "p_guest_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_guest_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_guest_phone" "text", "p_guest_name" "text", "p_guest_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_guest_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_guest_phone" "text", "p_guest_name" "text", "p_guest_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_guest_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_guest_phone" "text", "p_guest_name" "text", "p_guest_note" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."create_staff_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_payment_method" "text", "p_payment_status" "text", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_staff_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_payment_method" "text", "p_payment_status" "text", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_staff_order_with_payments"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric, "p_payment_splits" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_staff_order_with_payments"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric, "p_payment_splits" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_staff_order_with_payments"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_order_status" "text", "p_invoice_required" boolean, "p_company_name" "text", "p_tax_code" "text", "p_invoice_email" "text", "p_invoice_address" "text", "p_internal_note" "text", "p_manual_discount_type" "text", "p_manual_discount_value" numeric, "p_payment_splits" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_loyalty_points_to_redeem" integer, "p_discount_code" "text", "p_special_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_loyalty_points_to_redeem" integer, "p_discount_code" "text", "p_special_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_ticket_booking"("p_ticket_type" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_player_count" integer, "p_arena_count" integer, "p_game_options" "text"[], "p_unit_price" integer, "p_total_price" integer, "p_loyalty_points_to_redeem" integer, "p_discount_code" "text", "p_special_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_staff_actor_profile_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_staff_actor_profile_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_staff_actor_profile_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_staff_operator_session_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_staff_operator_session_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_staff_operator_session_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_staff_role_key"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_staff_role_key"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_staff_role_key"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_staff_role_rank"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_staff_role_rank"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_staff_role_rank"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."enforce_staff_payroll_compliance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_staff_payroll_compliance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_unique_player_identity"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."enqueue_club_admin_message_push"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_club_admin_message_push"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_club_session_push"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_club_session_push"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_due_session_reminders"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_due_session_reminders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_push_event"("p_recipient_id" "uuid", "p_event_key" "text", "p_event_type" "text", "p_session_id" "uuid", "p_title" "text", "p_body" "text", "p_url" "text", "p_metadata" "jsonb", "p_scheduled_for" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_push_event"("p_recipient_id" "uuid", "p_event_key" "text", "p_event_type" "text", "p_session_id" "uuid", "p_title" "text", "p_body" "text", "p_url" "text", "p_metadata" "jsonb", "p_scheduled_for" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_session_change_push"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_session_change_push"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_session_invite_push"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_session_invite_push"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_waitlist_promotion_push"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_waitlist_promotion_push"() TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("nickname") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("personal_data_consent") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("personal_data_consent_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("privacy_policy_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_emoji") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_initials") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_color") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("profile_motto") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_text_color") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("birthday") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("score_adjustment") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("anonymous_mode") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("anonymous_callsign") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("marketing_consent") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("marketing_consent_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("marketing_opted_out_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("loyalty_points_total") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("gender") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("terms_conditions_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("consent_waiver_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("legal_consent_version") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("onboarding_tour_completed_at"),UPDATE("onboarding_tour_completed_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("is_hr_record_only") ON TABLE "public"."profiles" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ensure_guest_ticket_profile"("p_guest_phone" "text", "p_guest_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_guest_ticket_profile"("p_guest_phone" "text", "p_guest_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_single_active_loyalty_rule"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_single_active_loyalty_rule"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_leaderboard_players"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_leaderboard_players"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players"() TO "anon";



REVOKE ALL ON FUNCTION "public"."get_leaderboard_players_page"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_leaderboard_players_page_session_only"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."get_leaderboard_players_page_v2"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page_v2"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page_v2"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page_v2"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_leaderboard_players_page_v3"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page_v3"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page_v3"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard_players_page_v3"("p_limit" integer, "p_offset" integer, "p_search" "text", "p_rank_by" "text", "p_profile_id" "uuid", "p_club_id" "uuid", "p_club_pin" "text", "p_game_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_player_game_count_overrides"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_player_game_count_overrides"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_my_player_game_count_overrides"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_soft_deleted_records"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_soft_deleted_records"("p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_soft_deleted_records"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_soft_deleted_records_v2"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_soft_deleted_records_v2"("p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_soft_deleted_records_v2"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_staff_daily_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_staff_daily_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_staff_daily_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."guest_ticket_phone_account_status"("p_guest_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guest_ticket_phone_account_status"("p_guest_phone" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."guest_ticket_phone_account_status"("p_guest_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."guest_ticket_phone_account_status"("p_guest_phone" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_staff_attendance_editor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff_attendance_editor"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_staff_attendance_editor"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_staff_console_user"("p_min_rank" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff_console_user"("p_min_rank" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_vrena_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_vrena_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_vrena_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_vrena_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_vrena_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_vrena_super_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."join_private_session_waitlist_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."join_private_session_with_code"("p_session_id" "uuid", "p_invite_code" "text", "p_display_name" "text", "p_avatar_url" "text", "p_avatar_emoji" "text", "p_avatar_initials" "text", "p_avatar_color" "text", "p_avatar_text_color" "text", "p_profile_motto" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_tournament_audit"("p_session_id" "uuid", "p_action" "text", "p_old_value" "jsonb", "p_new_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_tournament_audit"("p_session_id" "uuid", "p_action" "text", "p_old_value" "jsonb", "p_new_value" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."log_tournament_audit"("p_session_id" "uuid", "p_action" "text", "p_old_value" "jsonb", "p_new_value" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."normalize_guest_ticket_phone"("p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_guest_ticket_phone"("p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_player_identity"("p_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_player_identity"("p_value" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."normalize_player_identity"("p_value" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."notify_google_sheets_session_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_google_sheets_session_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_google_sheets_session_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_google_sheets_session_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."owns_tournament"("target_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owns_tournament"("target_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_achievement_awards_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."profile_achievement_awards_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_achievement_awards_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_achievement_unlock_views_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."profile_achievement_unlock_views_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_achievement_unlock_views_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_anonymous_callsign"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_anonymous_callsign"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."profile_anonymous_callsign"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_anonymous_callsign"("p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_has_account"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_has_account"("p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_public_display_name"("p_profile_id" "uuid", "p_nickname" "text", "p_full_name" "text", "p_phone" "text", "p_anonymous_mode" boolean, "p_anonymous_callsign" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_public_display_name"("p_profile_id" "uuid", "p_nickname" "text", "p_full_name" "text", "p_phone" "text", "p_anonymous_mode" boolean, "p_anonymous_callsign" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."profile_public_display_name"("p_profile_id" "uuid", "p_nickname" "text", "p_full_name" "text", "p_phone" "text", "p_anonymous_mode" boolean, "p_anonymous_callsign" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_public_display_name"("p_profile_id" "uuid", "p_nickname" "text", "p_full_name" "text", "p_phone" "text", "p_anonymous_mode" boolean, "p_anonymous_callsign" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_search"("p_search" "text", "p_limit" integer, "p_offset" integer, "p_role" "text", "p_include_demo" boolean, "p_sort" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_search"("p_search" "text", "p_limit" integer, "p_offset" integer, "p_role" "text", "p_include_demo" boolean, "p_sort" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."profile_search"("p_search" "text", "p_limit" integer, "p_offset" integer, "p_role" "text", "p_include_demo" boolean, "p_sort" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."promote_session_waitlist"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_session_waitlist"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."promote_session_waitlist_internal"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_session_waitlist_internal"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."promote_waitlist_after_participant_departure"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_waitlist_after_participant_departure"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_minor_birthday_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_minor_birthday_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_loyalty_points_total"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_loyalty_points_total"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_sensitive_fields"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_sensitive_fields"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_session_client_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_session_client_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_session_participant_trusted_fields"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_session_participant_trusted_fields"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_ticket_session_boundary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_ticket_session_boundary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_profile_search"("p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_profile_search"("p_search" "text", "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."public_profile_search"("p_search" "text", "p_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."push_session_body"("p_name" "text", "p_date" "date", "p_start" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."push_session_body"("p_name" "text", "p_date" "date", "p_start" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."push_session_body"("p_name" "text", "p_date" "date", "p_start" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rate_limit_session_creates"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rate_limit_session_creates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rate_limit_session_invites"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rate_limit_session_invites"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rate_limit_staff_config_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rate_limit_staff_config_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_club_member_count"("target_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_club_member_count"("target_club_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_club_member_count_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_club_member_count_trigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_soft_deleted_record"("p_entity_table" "text", "p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_soft_deleted_record"("p_entity_table" "text", "p_entity_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."restore_soft_deleted_record"("p_entity_table" "text", "p_entity_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."service_consume_venue_support_bundle_token"("p_bundle_id" "uuid", "p_token_digest" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_consume_venue_support_bundle_token"("p_bundle_id" "uuid", "p_token_digest" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_matched_session_id" "uuid", "p_matched_participant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_matched_session_id" "uuid", "p_matched_participant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_venue_key" "text", "p_matched_session_id" "uuid", "p_matched_participant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_ingest_venue_game_result"("p_profile_id" "uuid", "p_player_name" "text", "p_game_name" "text", "p_game_slug" "text", "p_score" integer, "p_hits" integer, "p_accuracy_percent" double precision, "p_movement_meters" numeric, "p_external_session_label" "text", "p_captured_at" timestamp with time zone, "p_source_capture_id" "text", "p_source_device" "text", "p_match_status" "text", "p_venue_key" "text", "p_matched_session_id" "uuid", "p_matched_participant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_profile_nickname_available"("p_nickname" "text", "p_exclude_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_profile_nickname_available"("p_nickname" "text", "p_exclude_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_profiles_for_venue_identity"("p_player_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_profiles_for_venue_identity"("p_player_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_release_venue_upload"("p_reservation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_release_venue_upload"("p_reservation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_reserve_venue_upload"("p_venue_key" "text", "p_upload_kind" "text", "p_bytes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_reserve_venue_upload"("p_venue_key" "text", "p_upload_kind" "text", "p_bytes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."session_detail"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."session_detail"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."session_detail"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_detail"("p_session_id" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."sessions_list_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_include_blocked_times" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sessions_list_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_include_blocked_times" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."sessions_list_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_include_blocked_times" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sessions_list_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_include_blocked_times" boolean) TO "anon";



REVOKE ALL ON FUNCTION "public"."set_profile_loyalty_points"("p_profile_id" "uuid", "p_points" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profile_loyalty_points"("p_profile_id" "uuid", "p_points" integer, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profile_score_adjustment"("p_profile_id" "uuid", "p_score_adjustment" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profile_score_adjustment"("p_profile_id" "uuid", "p_score_adjustment" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision, "p_best_escape_duration_seconds" integer, "p_update_average_accuracy" boolean, "p_update_best_escape_duration" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision, "p_best_escape_duration_seconds" integer, "p_update_average_accuracy" boolean, "p_update_best_escape_duration" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision, "p_best_escape_duration_seconds" integer, "p_update_average_accuracy" boolean, "p_update_best_escape_duration" boolean, "p_total_projectiles" integer, "p_update_total_projectiles" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profile_stat_overrides"("p_profile_id" "uuid", "p_average_accuracy" double precision, "p_best_escape_duration_seconds" integer, "p_update_average_accuracy" boolean, "p_update_best_escape_duration" boolean, "p_total_projectiles" integer, "p_update_total_projectiles" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_session_participant_chapter_time"("p_participant_id" "uuid", "p_game_slug" "text", "p_chapter_number" integer, "p_duration_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_session_participant_chapter_time"("p_participant_id" "uuid", "p_game_slug" "text", "p_chapter_number" integer, "p_duration_seconds" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."set_session_participant_chapter_time"("p_participant_id" "uuid", "p_game_slug" "text", "p_chapter_number" integer, "p_duration_seconds" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_staff_profile_role"("p_profile_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_staff_profile_role"("p_profile_id" "uuid", "p_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_staff_profile_role"("p_profile_id" "uuid", "p_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."soft_delete_record"("p_entity_table" "text", "p_entity_id" "uuid", "p_delete_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_record"("p_entity_table" "text", "p_entity_id" "uuid", "p_delete_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."soft_delete_record"("p_entity_table" "text", "p_entity_id" "uuid", "p_delete_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."soft_delete_tournament_records"("p_session_id" "uuid", "p_include_pools" boolean, "p_delete_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_tournament_records"("p_session_id" "uuid", "p_include_pools" boolean, "p_delete_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."soft_delete_tournament_records"("p_session_id" "uuid", "p_include_pools" boolean, "p_delete_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_approve_attendance_period"("p_period_start" "date", "p_period_end" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_approve_attendance_period"("p_period_start" "date", "p_period_end" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_approve_attendance_period"("p_period_start" "date", "p_period_end" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."staff_attendance_apply_rules"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_attendance_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_attendance_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_audit_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_audit_trigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_award_profile_achievement"("p_profile_id" "uuid", "p_achievement_id" "text", "p_achievement_kind" "text", "p_title" "text", "p_description" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_award_profile_achievement"("p_profile_id" "uuid", "p_achievement_id" "text", "p_achievement_kind" "text", "p_title" "text", "p_description" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_award_profile_achievement"("p_profile_id" "uuid", "p_achievement_id" "text", "p_achievement_kind" "text", "p_title" "text", "p_description" "text", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_delete_profile_account"("p_profile_id" "uuid", "p_delete_reason" "text", "p_ban" boolean, "p_ban_reason" "text", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_delete_profile_account"("p_profile_id" "uuid", "p_delete_reason" "text", "p_ban" boolean, "p_ban_reason" "text", "p_confirmation" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_delete_profile_account"("p_profile_id" "uuid", "p_delete_reason" "text", "p_ban" boolean, "p_ban_reason" "text", "p_confirmation" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_delete_session_operation"("p_session_id" "uuid", "p_delete_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_delete_session_operation"("p_session_id" "uuid", "p_delete_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_delete_session_operation"("p_session_id" "uuid", "p_delete_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_discount_rule_amount"("p_discount_type" "text", "p_value" numeric, "p_subtotal" integer, "p_unit_price" integer, "p_max_discount_amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_discount_rule_amount"("p_discount_type" "text", "p_value" numeric, "p_subtotal" integer, "p_unit_price" integer, "p_max_discount_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."staff_discount_rule_amount"("p_discount_type" "text", "p_value" numeric, "p_subtotal" integer, "p_unit_price" integer, "p_max_discount_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_discount_rule_amount"("p_discount_type" "text", "p_value" numeric, "p_subtotal" integer, "p_unit_price" integer, "p_max_discount_amount" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone, "p_player_count" integer, "p_subtotal" integer, "p_requested_ticket_type" "text", "p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone, "p_player_count" integer, "p_subtotal" integer, "p_requested_ticket_type" "text", "p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_rule_price_rule_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text", "p_requested_price_rule_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_player_count" integer, "p_subtotal" integer, "p_requested_ticket_type" "text", "p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_discount_rule_matches_context"("p_rule_game_id" "uuid", "p_rule_price_rule_id" "uuid", "p_min_players" integer, "p_max_players" integer, "p_day_scope" "text", "p_time_start" time without time zone, "p_time_end" time without time zone, "p_ticket_type" "text", "p_min_order_total" integer, "p_per_customer_limit" integer, "p_discount_rule_id" "uuid", "p_requested_game_id" "text", "p_requested_price_rule_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_player_count" integer, "p_subtotal" integer, "p_requested_ticket_type" "text", "p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_discount_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_discount_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."staff_discount_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_discount_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_employee_directory"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_employee_directory"() TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_employee_directory"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_get_player_achievement_history"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_get_player_achievement_history"("p_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_get_player_achievement_history"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_get_player_stat_overrides"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_get_player_stat_overrides"("p_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_get_player_stat_overrides"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_hr_create_employee_record"("p_actor_user_id" "uuid", "p_full_name" "text", "p_personal_email" "text", "p_personal_phone" "text", "p_employment_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_hr_create_employee_record"("p_actor_user_id" "uuid", "p_full_name" "text", "p_personal_email" "text", "p_personal_phone" "text", "p_employment_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_audit_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_kiosk_audit_mutation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_configure_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid", "p_pin" "text", "p_access_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_kiosk_configure_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid", "p_pin" "text", "p_access_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_reveal_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_kiosk_reveal_pin"("p_actor_user_id" "uuid", "p_actor_profile_id" "uuid", "p_operator_token_hash" "text", "p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_revoke_session"("p_actor_user_id" "uuid", "p_token_hash" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_kiosk_revoke_session"("p_actor_user_id" "uuid", "p_token_hash" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_touch_session"("p_actor_user_id" "uuid", "p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_kiosk_touch_session"("p_actor_user_id" "uuid", "p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_kiosk_verify_pin"("p_actor_user_id" "uuid", "p_profile_id" "uuid", "p_pin" "text", "p_token_hash" "text", "p_user_agent_hash" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."staff_list_player_session_options"("p_profile_id" "uuid", "p_month" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_list_player_session_options"("p_profile_id" "uuid", "p_month" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_list_player_session_options"("p_profile_id" "uuid", "p_month" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_loyalty_audit_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_loyalty_audit_trigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_loyalty_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_loyalty_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_loyalty_rule_matches_game"("p_rule_game_id" "uuid", "p_requested_game_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_order_loyalty_award_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_order_loyalty_award_trigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_orders_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_search" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_orders_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_search" "text", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_orders_page"("p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer, "p_search" "text", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_player_behavior_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_player_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_player_behavior_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_player_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_player_behavior_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_player_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_product_analytics_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_product_analytics_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_product_analytics_report"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_progressive_pit"("p_taxable_income" bigint, "p_brackets" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_progressive_pit"("p_taxable_income" bigint, "p_brackets" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_remove_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_remove_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_remove_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_report_summary"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_report_summary"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_report_summary"("p_start_date" "date", "p_end_date" "date", "p_compare_start" "date", "p_compare_end" "date", "p_order_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_role_rank"("p_role" "text", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_save_player_achievement_profile"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_save_player_achievement_profile"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_save_player_achievement_profile"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_save_player_achievement_profile_v2"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_save_player_achievement_profile_v2"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_save_player_achievement_profile_v2"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_save_player_achievement_profile_v3"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_save_player_achievement_profile_v3"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_save_player_achievement_profile_v3"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb", "p_achievement_changes" "jsonb", "p_note" "text", "p_session_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON TABLE "public"."staff_hr_setup_options" TO "anon";
GRANT ALL ON TABLE "public"."staff_hr_setup_options" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_hr_setup_options" TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_set_hr_setup_option_active"("p_option_id" "uuid", "p_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_set_hr_setup_option_active"("p_option_id" "uuid", "p_active" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_set_hr_setup_option_active"("p_option_id" "uuid", "p_active" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."staff_set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_set_order_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_set_player_stat_overrides"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_set_player_stat_overrides"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_set_player_stat_overrides"("p_profile_id" "uuid", "p_loyalty_points" integer, "p_overall" "jsonb", "p_games" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."staff_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_sync_payroll_draft"("p_run_date" "date", "p_force" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_sync_payroll_draft"("p_run_date" "date", "p_force" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_sync_payroll_draft"("p_run_date" "date", "p_force" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_ticket_price_rule_id"("p_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_ticket_price_rule_id"("p_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."staff_ticket_price_rule_id"("p_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_ticket_price_rule_id"("p_game_id" "text", "p_booking_date" "date", "p_booking_time" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_update_hr_setup_option"("p_option_id" "uuid", "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_update_hr_setup_option"("p_option_id" "uuid", "p_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_update_hr_setup_option"("p_option_id" "uuid", "p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_update_order_operation"("p_order_id" "uuid", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_total" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_update_order_operation"("p_order_id" "uuid", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_total" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_update_order_operation"("p_order_id" "uuid", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_total" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_update_session_operation"("p_session_id" "uuid", "p_name" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_max_players" integer, "p_arena_count" integer, "p_visibility" "text", "p_status" "text", "p_confirmed_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_update_session_operation"("p_session_id" "uuid", "p_name" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_max_players" integer, "p_arena_count" integer, "p_visibility" "text", "p_status" "text", "p_confirmed_game_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_update_session_operation"("p_session_id" "uuid", "p_name" "text", "p_date" "date", "p_start_time" time without time zone, "p_duration_minutes" integer, "p_max_players" integer, "p_arena_count" integer, "p_visibility" "text", "p_status" "text", "p_confirmed_game_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_upsert_hr_setup_option"("p_option_type" "text", "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_upsert_hr_setup_option"("p_option_type" "text", "p_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_upsert_hr_setup_option"("p_option_type" "text", "p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_upsert_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_projectiles_fired" integer, "p_escape_duration_seconds" integer, "p_placement" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_upsert_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_projectiles_fired" integer, "p_escape_duration_seconds" integer, "p_placement" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_upsert_session_participant_operation"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_projectiles_fired" integer, "p_escape_duration_seconds" integer, "p_placement" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_upsert_session_participant_result_v2"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_hits" integer, "p_movement_meters" numeric, "p_escape_duration_seconds" integer, "p_placement" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_upsert_session_participant_result_v2"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_hits" integer, "p_movement_meters" numeric, "p_escape_duration_seconds" integer, "p_placement" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."staff_upsert_session_participant_result_v2"("p_session_id" "uuid", "p_participant_id" "uuid", "p_profile_id" "uuid", "p_display_name" "text", "p_checked_in" boolean, "p_payment_status" "text", "p_payment_amount" integer, "p_score" integer, "p_accuracy_percent" double precision, "p_hits" integer, "p_movement_meters" numeric, "p_escape_duration_seconds" integer, "p_placement" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_now" timestamp with time zone) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_latitude" double precision, "p_longitude" double precision, "p_location_provider" "text", "p_now" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_zalo_attendance_clock"("p_identity_id" "uuid", "p_action" "text", "p_latitude" double precision, "p_longitude" double precision, "p_location_provider" "text", "p_now" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_challenge_invite_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_challenge_invite_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_profile_public_snapshot"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_profile_public_snapshot"("p_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."sync_profile_public_snapshot"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."sync_session_participant_legacy_hits"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_session_participant_legacy_hits"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ticket_automatic_discount_quote"("p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_automatic_discount_quote"("p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."ticket_automatic_discount_quote"("p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ticket_automatic_discount_quote"("p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."ticket_booking_start_is_past"("p_date" "date", "p_start_time" time without time zone, "p_now" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_booking_start_is_past"("p_date" "date", "p_start_time" time without time zone, "p_now" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ticket_discount_code_quote"("p_code" "text", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_discount_code_quote"("p_code" "text", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."ticket_discount_code_quote"("p_code" "text", "p_booking_date" "date", "p_subtotal" integer, "p_unit_price" integer, "p_game_id" "text", "p_player_count" integer, "p_start_time" time without time zone, "p_ticket_type" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ticket_loyalty_earn_quote"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_loyalty_earn_quote"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."ticket_loyalty_earn_quote"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ticket_loyalty_earn_quote"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) TO "anon";



REVOKE ALL ON FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."ticket_loyalty_redemption_settings"("p_game_id" "text", "p_booking_date" "date", "p_paid_total" integer, "p_player_count" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ticket_minimum_duration_minutes"("p_venue_key" "text", "p_date" "date", "p_player_count" integer, "p_arena_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_minimum_duration_minutes"("p_venue_key" "text", "p_date" "date", "p_player_count" integer, "p_arena_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ticket_tariff_price_block_minutes"("p_booking_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_tariff_price_block_minutes"("p_booking_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ticket_tariff_unit_price"("p_venue_key" "text", "p_ticket_type" "text", "p_booking_date" "date", "p_start_time" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_tariff_unit_price"("p_venue_key" "text", "p_ticket_type" "text", "p_booking_date" "date", "p_start_time" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfer_club_ownership"("p_club_id" "uuid", "p_new_owner_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_club_ownership"("p_club_id" "uuid", "p_new_owner_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."transfer_club_ownership"("p_club_id" "uuid", "p_new_owner_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."validate_matched_venue_result_check_in"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_matched_venue_result_check_in"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."vrena_delete_session_scoped_rows"("p_table_name" "text", "p_session_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vrena_delete_session_scoped_rows"("p_table_name" "text", "p_session_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."vrena_seed_official_weekly_sessions"("p_seed_batch" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vrena_seed_official_weekly_sessions"("p_seed_batch" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vrena_soft_launch_prepare_demo_auth_users"("p_allow_production_seed" boolean, "p_seed_batch" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vrena_soft_launch_prepare_demo_auth_users"("p_allow_production_seed" boolean, "p_seed_batch" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vrena_soft_launch_reset_seed"("p_allow_production_seed" boolean, "p_seed_batch" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vrena_soft_launch_reset_seed"("p_allow_production_seed" boolean, "p_seed_batch" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vrena_soft_launch_reset_seed_with_demo_auth"("p_allow_production_seed" boolean, "p_seed_batch" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vrena_soft_launch_reset_seed_with_demo_auth"("p_allow_production_seed" boolean, "p_seed_batch" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vrena_soft_launch_rollback_seed"("p_allow_production_seed" boolean, "p_seed_batch" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vrena_soft_launch_rollback_seed"("p_allow_production_seed" boolean, "p_seed_batch" "text") TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "private"."integration_settings" TO "service_role";



GRANT ALL ON TABLE "private"."staff_kiosk_operator_sessions" TO "service_role";



GRANT ALL ON TABLE "private"."staff_kiosk_pin_attempts" TO "service_role";



GRANT ALL ON TABLE "private"."staff_kiosk_pin_credentials" TO "service_role";



GRANT ALL ON TABLE "private"."venue_upload_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."app_analytics_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app_analytics_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_analytics_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_analytics_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_times" TO "anon";
GRANT ALL ON TABLE "public"."blocked_times" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_times" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."club_members" TO "authenticated";



GRANT ALL ON TABLE "public"."club_messages" TO "anon";
GRANT ALL ON TABLE "public"."club_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."club_messages" TO "service_role";



GRANT UPDATE("deleted_at") ON TABLE "public"."club_messages" TO "authenticated";



GRANT UPDATE("deleted_by") ON TABLE "public"."club_messages" TO "authenticated";



GRANT UPDATE("delete_reason") ON TABLE "public"."club_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT UPDATE("name") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("description") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("visibility") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("pin_code") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("motto") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("banner_url") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("theme_color") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("default_language") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("ranking_criterion") ON TABLE "public"."clubs" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."clubs" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_point_transactions" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_point_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_point_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_list" TO "anon";
GRANT ALL ON TABLE "public"."marketing_list" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_list" TO "service_role";



GRANT ALL ON TABLE "public"."message_translations" TO "service_role";



GRANT ALL ON TABLE "public"."player_stat_overrides" TO "service_role";
GRANT SELECT ON TABLE "public"."player_stat_overrides" TO "authenticated";



GRANT ALL ON TABLE "public"."player_zalo_handoffs" TO "service_role";



GRANT ALL ON TABLE "public"."player_zalo_identities" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."profile_achievement_awards" TO "anon";
GRANT ALL ON TABLE "public"."profile_achievement_awards" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_achievement_awards" TO "service_role";



GRANT ALL ON TABLE "public"."profile_achievement_unlock_views" TO "anon";
GRANT ALL ON TABLE "public"."profile_achievement_unlock_views" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_achievement_unlock_views" TO "service_role";



GRANT ALL ON TABLE "public"."push_events" TO "anon";
GRANT ALL ON TABLE "public"."push_events" TO "authenticated";
GRANT ALL ON TABLE "public"."push_events" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."security_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."session_invites" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."session_invites" TO "authenticated";



GRANT ALL ON TABLE "public"."session_messages" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."session_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."session_messages" TO "service_role";



GRANT UPDATE("moderation_status") ON TABLE "public"."session_messages" TO "authenticated";



GRANT UPDATE("reviewed_by") ON TABLE "public"."session_messages" TO "authenticated";



GRANT UPDATE("reviewed_at") ON TABLE "public"."session_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."session_participant_chapter_times" TO "anon";
GRANT ALL ON TABLE "public"."session_participant_chapter_times" TO "authenticated";
GRANT ALL ON TABLE "public"."session_participant_chapter_times" TO "service_role";



GRANT ALL ON TABLE "public"."session_participants" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."session_participants" TO "authenticated";



GRANT ALL ON TABLE "public"."session_waitlist" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."session_waitlist" TO "authenticated";



GRANT ALL ON TABLE "public"."sessions" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_attendance_approvals" TO "service_role";
GRANT SELECT ON TABLE "public"."staff_attendance_approvals" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_attendance_logs" TO "anon";
GRANT ALL ON TABLE "public"."staff_attendance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_attendance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."staff_attendance_settings" TO "anon";
GRANT ALL ON TABLE "public"."staff_attendance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_attendance_settings" TO "service_role";



GRANT ALL ON TABLE "public"."staff_check_in_locations" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."staff_check_in_locations" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_cost_assignments" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."staff_cost_assignments" TO "authenticated";



GRANT UPDATE("cancelled_at") ON TABLE "public"."staff_cost_assignments" TO "authenticated";



GRANT UPDATE("cancelled_by") ON TABLE "public"."staff_cost_assignments" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_discount_rules" TO "anon";
GRANT ALL ON TABLE "public"."staff_discount_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_discount_rules" TO "service_role";



GRANT ALL ON TABLE "public"."staff_employee_profiles" TO "anon";
GRANT ALL ON TABLE "public"."staff_employee_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_employee_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."staff_games" TO "anon";
GRANT ALL ON TABLE "public"."staff_games" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_games" TO "service_role";



GRANT ALL ON TABLE "public"."staff_hr_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."staff_hr_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_hr_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."staff_hr_documents" TO "anon";
GRANT ALL ON TABLE "public"."staff_hr_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_hr_documents" TO "service_role";



GRANT ALL ON TABLE "public"."staff_hr_policy_versions" TO "service_role";
GRANT SELECT ON TABLE "public"."staff_hr_policy_versions" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_hr_settings" TO "anon";
GRANT ALL ON TABLE "public"."staff_hr_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_hr_settings" TO "service_role";



GRANT ALL ON TABLE "public"."staff_leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."staff_leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."staff_loyalty_rules" TO "anon";
GRANT ALL ON TABLE "public"."staff_loyalty_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_loyalty_rules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_order_payments" TO "anon";
GRANT ALL ON TABLE "public"."staff_order_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_order_payments" TO "service_role";



GRANT ALL ON TABLE "public"."staff_orders" TO "anon";
GRANT ALL ON TABLE "public"."staff_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_orders" TO "service_role";



GRANT ALL ON TABLE "public"."staff_payroll_items" TO "anon";
GRANT ALL ON TABLE "public"."staff_payroll_items" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_payroll_items" TO "service_role";



GRANT ALL ON TABLE "public"."staff_payroll_runs" TO "anon";
GRANT ALL ON TABLE "public"."staff_payroll_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_payroll_runs" TO "service_role";



GRANT ALL ON TABLE "public"."staff_payroll_source_snapshots" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."staff_payroll_source_snapshots" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."staff_pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."staff_schedule_shifts" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedule_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedule_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."staff_zalo_attendance_events" TO "service_role";



GRANT ALL ON TABLE "public"."staff_zalo_identities" TO "service_role";



GRANT ALL ON TABLE "public"."staff_zalo_settings" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."staff_zalo_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."tournament_audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tournament_audit_log" TO "authenticated";



GRANT ALL ON TABLE "public"."tournament_editors" TO "anon";
GRANT ALL ON TABLE "public"."tournament_editors" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_editors" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_matches" TO "anon";
GRANT ALL ON TABLE "public"."tournament_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_matches" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_pool_entries" TO "anon";
GRANT ALL ON TABLE "public"."tournament_pool_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_pool_entries" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_pools" TO "anon";
GRANT ALL ON TABLE "public"."tournament_pools" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_pools" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_team_members" TO "anon";
GRANT ALL ON TABLE "public"."tournament_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_teams" TO "anon";
GRANT ALL ON TABLE "public"."tournament_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_teams" TO "service_role";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT ALL ON TABLE "public"."venue_game_result_duplicate_archive" TO "service_role";



GRANT ALL ON TABLE "public"."venue_game_results" TO "service_role";
GRANT SELECT ON TABLE "public"."venue_game_results" TO "authenticated";



GRANT ALL ON TABLE "public"."venue_result_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."venue_support_bundle_download_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."venue_support_bundles" TO "service_role";



GRANT ALL ON TABLE "public"."vouchers" TO "anon";
GRANT ALL ON TABLE "public"."vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."vouchers" TO "service_role";



GRANT ALL ON TABLE "public"."zalo_webhook_receipts" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
