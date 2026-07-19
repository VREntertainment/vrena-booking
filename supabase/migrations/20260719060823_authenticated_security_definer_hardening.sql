begin;

-- RLS helper functions must remain executable while their policies are
-- evaluated, but they do not need to be RPC endpoints in the exposed public
-- schema. Move the privileged implementations to the non-exposed private
-- schema. PostgreSQL keeps the policy dependencies attached to the same
-- function OIDs when their schema changes.
alter function public.can_insert_club_member_row(uuid, uuid, text) set schema private;
alter function public.can_join_session_row(uuid) set schema private;
alter function public.can_manage_avatar_object_path(text) set schema private;
alter function public.can_manage_club_banner_path(text) set schema private;
alter function public.can_manage_club_member(uuid, uuid, text) set schema private;
alter function public.can_manage_club_settings(uuid) set schema private;
alter function public.can_manage_session_row(uuid) set schema private;
alter function public.can_manage_staff_game_image_path(text) set schema private;
alter function public.can_manage_staff_hr_document_path(text) set schema private;
alter function public.can_manage_tournament(uuid) set schema private;
alter function public.can_read_club_member_row(uuid, uuid) set schema private;
alter function public.can_read_staff_attendance_row(uuid) set schema private;
alter function public.can_read_staff_attendance_settings() set schema private;
alter function public.can_read_staff_hr_document_path(text) set schema private;
alter function public.can_use_club_messages(uuid) set schema private;
alter function public.can_view_session_row(uuid) set schema private;
alter function public.is_staff_attendance_editor() set schema private;
alter function public.is_staff_console_user(integer) set schema private;
alter function public.is_vrena_admin() set schema private;
alter function public.is_vrena_owner() set schema private;
alter function public.owns_tournament(uuid) set schema private;

revoke all on function private.can_insert_club_member_row(uuid, uuid, text) from public, anon;
revoke all on function private.can_join_session_row(uuid) from public, anon;
revoke all on function private.can_manage_avatar_object_path(text) from public, anon;
revoke all on function private.can_manage_club_banner_path(text) from public, anon;
revoke all on function private.can_manage_club_member(uuid, uuid, text) from public, anon;
revoke all on function private.can_manage_club_settings(uuid) from public, anon;
revoke all on function private.can_manage_session_row(uuid) from public, anon;
revoke all on function private.can_manage_staff_game_image_path(text) from public, anon;
revoke all on function private.can_manage_staff_hr_document_path(text) from public, anon;
revoke all on function private.can_manage_tournament(uuid) from public, anon;
revoke all on function private.can_read_club_member_row(uuid, uuid) from public, anon;
revoke all on function private.can_read_staff_attendance_row(uuid) from public, anon;
revoke all on function private.can_read_staff_attendance_settings() from public, anon;
revoke all on function private.can_read_staff_hr_document_path(text) from public, anon;
revoke all on function private.can_use_club_messages(uuid) from public, anon;
revoke all on function private.can_view_session_row(uuid) from public, anon;
revoke all on function private.is_staff_attendance_editor() from public, anon;
revoke all on function private.is_staff_console_user(integer) from public, anon;
revoke all on function private.is_vrena_admin() from public, anon;
revoke all on function private.is_vrena_owner() from public, anon;
revoke all on function private.owns_tournament(uuid) from public, anon;

grant execute on function private.can_insert_club_member_row(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.can_join_session_row(uuid) to authenticated, service_role;
grant execute on function private.can_manage_avatar_object_path(text) to authenticated, service_role;
grant execute on function private.can_manage_club_banner_path(text) to authenticated, service_role;
grant execute on function private.can_manage_club_member(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.can_manage_club_settings(uuid) to authenticated, service_role;
grant execute on function private.can_manage_session_row(uuid) to authenticated, service_role;
grant execute on function private.can_manage_staff_game_image_path(text) to authenticated, service_role;
grant execute on function private.can_manage_staff_hr_document_path(text) to authenticated, service_role;
grant execute on function private.can_manage_tournament(uuid) to authenticated, service_role;
grant execute on function private.can_read_club_member_row(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_staff_attendance_row(uuid) to authenticated, service_role;
grant execute on function private.can_read_staff_attendance_settings() to authenticated, service_role;
grant execute on function private.can_read_staff_hr_document_path(text) to authenticated, service_role;
grant execute on function private.can_use_club_messages(uuid) to authenticated, service_role;
grant execute on function private.can_view_session_row(uuid) to authenticated, service_role;
grant execute on function private.is_staff_attendance_editor() to authenticated, service_role;
grant execute on function private.is_staff_console_user(integer) to authenticated, service_role;
grant execute on function private.is_vrena_admin() to authenticated, service_role;
grant execute on function private.is_vrena_owner() to authenticated, service_role;
grant execute on function private.owns_tournament(uuid) to authenticated, service_role;

-- Keep non-privileged compatibility shims for privileged database functions
-- that explicitly call the historical public helper names. Browser roles do
-- not receive EXECUTE, so these shims are not Data API endpoints.
create function public.can_insert_club_member_row(
  p_club_id uuid,
  p_member_profile_id uuid,
  p_status text
)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_insert_club_member_row(p_club_id, p_member_profile_id, p_status) $$;

create function public.can_join_session_row(p_session_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_join_session_row(p_session_id) $$;

create function public.can_manage_avatar_object_path(p_object_name text)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_manage_avatar_object_path(p_object_name) $$;

create function public.can_manage_club_banner_path(p_object_name text)
returns boolean language sql volatile security invoker set search_path = pg_catalog
as $$ select private.can_manage_club_banner_path(p_object_name) $$;

create function public.can_manage_club_member(
  p_club_id uuid,
  p_target_profile_id uuid,
  p_target_role text default 'member'
)
returns boolean language sql volatile security invoker set search_path = pg_catalog
as $$ select private.can_manage_club_member(p_club_id, p_target_profile_id, p_target_role) $$;

create function public.can_manage_club_settings(p_club_id uuid)
returns boolean language sql volatile security invoker set search_path = pg_catalog
as $$ select private.can_manage_club_settings(p_club_id) $$;

create function public.can_manage_session_row(p_session_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_manage_session_row(p_session_id) $$;

create function public.can_manage_staff_game_image_path(p_object_name text)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_manage_staff_game_image_path(p_object_name) $$;

create function public.can_manage_staff_hr_document_path(p_object_name text)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_manage_staff_hr_document_path(p_object_name) $$;

create function public.can_manage_tournament(target_session_id uuid)
returns boolean language sql volatile security invoker set search_path = pg_catalog
as $$ select private.can_manage_tournament(target_session_id) $$;

create function public.can_read_club_member_row(p_club_id uuid, p_member_profile_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_read_club_member_row(p_club_id, p_member_profile_id) $$;

create function public.can_read_staff_attendance_row(p_profile_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_read_staff_attendance_row(p_profile_id) $$;

create function public.can_read_staff_attendance_settings()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_read_staff_attendance_settings() $$;

create function public.can_read_staff_hr_document_path(p_object_name text)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_read_staff_hr_document_path(p_object_name) $$;

create function public.can_use_club_messages(p_club_id uuid)
returns boolean language sql volatile security invoker set search_path = pg_catalog
as $$ select private.can_use_club_messages(p_club_id) $$;

create function public.can_view_session_row(p_session_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_view_session_row(p_session_id) $$;

create function public.is_staff_attendance_editor()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.is_staff_attendance_editor() $$;

create function public.is_staff_console_user(p_min_rank integer default 20)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.is_staff_console_user(p_min_rank) $$;

create function public.is_vrena_admin()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.is_vrena_admin() $$;

create function public.is_vrena_owner()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.is_vrena_owner() $$;

create function public.owns_tournament(target_session_id uuid)
returns boolean language sql volatile security invoker set search_path = pg_catalog
as $$ select private.owns_tournament(target_session_id) $$;

revoke all on function public.can_insert_club_member_row(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.can_join_session_row(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_avatar_object_path(text) from public, anon, authenticated;
revoke all on function public.can_manage_club_banner_path(text) from public, anon, authenticated;
revoke all on function public.can_manage_club_member(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.can_manage_club_settings(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_session_row(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_staff_game_image_path(text) from public, anon, authenticated;
revoke all on function public.can_manage_staff_hr_document_path(text) from public, anon, authenticated;
revoke all on function public.can_manage_tournament(uuid) from public, anon, authenticated;
revoke all on function public.can_read_club_member_row(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_read_staff_attendance_row(uuid) from public, anon, authenticated;
revoke all on function public.can_read_staff_attendance_settings() from public, anon, authenticated;
revoke all on function public.can_read_staff_hr_document_path(text) from public, anon, authenticated;
revoke all on function public.can_use_club_messages(uuid) from public, anon, authenticated;
revoke all on function public.can_view_session_row(uuid) from public, anon, authenticated;
revoke all on function public.is_staff_attendance_editor() from public, anon, authenticated;
revoke all on function public.is_staff_console_user(integer) from public, anon, authenticated;
revoke all on function public.is_vrena_admin() from public, anon, authenticated;
revoke all on function public.is_vrena_owner() from public, anon, authenticated;
revoke all on function public.owns_tournament(uuid) from public, anon, authenticated;

grant execute on function public.can_insert_club_member_row(uuid, uuid, text) to service_role;
grant execute on function public.can_join_session_row(uuid) to service_role;
grant execute on function public.can_manage_avatar_object_path(text) to service_role;
grant execute on function public.can_manage_club_banner_path(text) to service_role;
grant execute on function public.can_manage_club_member(uuid, uuid, text) to service_role;
grant execute on function public.can_manage_club_settings(uuid) to service_role;
grant execute on function public.can_manage_session_row(uuid) to service_role;
grant execute on function public.can_manage_staff_game_image_path(text) to service_role;
grant execute on function public.can_manage_staff_hr_document_path(text) to service_role;
grant execute on function public.can_manage_tournament(uuid) to service_role;
grant execute on function public.can_read_club_member_row(uuid, uuid) to service_role;
grant execute on function public.can_read_staff_attendance_row(uuid) to service_role;
grant execute on function public.can_read_staff_attendance_settings() to service_role;
grant execute on function public.can_read_staff_hr_document_path(text) to service_role;
grant execute on function public.can_use_club_messages(uuid) to service_role;
grant execute on function public.can_view_session_row(uuid) to service_role;
grant execute on function public.is_staff_attendance_editor() to service_role;
grant execute on function public.is_staff_console_user(integer) to service_role;
grant execute on function public.is_vrena_admin() to service_role;
grant execute on function public.is_vrena_owner() to service_role;
grant execute on function public.owns_tournament(uuid) to service_role;

-- The generic primitive accepts caller-selected limits and subjects. It is an
-- internal building block, not a browser RPC. Keep a public compatibility shim
-- for trusted server clients and privileged functions only.
alter function public.consume_rate_limit(text, integer, integer, text) set schema private;
revoke all on function private.consume_rate_limit(text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function private.consume_rate_limit(text, integer, integer, text)
  to service_role;

create function public.consume_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_subject text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = pg_catalog
as $$
  select private.consume_rate_limit(p_action, p_limit, p_window_seconds, p_subject)
$$;

revoke all on function public.consume_rate_limit(text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer, text)
  to service_role;

-- current_staff_role_key is used by privileged helper functions but is not a
-- client API. current_staff_role_rank remains the reviewed public staff-status
-- endpoint used by the session-message Edge Function.
revoke all on function public.current_staff_role_key()
  from public, anon, authenticated;
grant execute on function public.current_staff_role_key()
  to service_role;

-- Wrap sensitive authenticated RPCs so rate limiting is enforced inside the
-- database boundary and cannot be skipped by calling PostgREST directly.
alter function public.claim_guest_ticket_booking(text, text) set schema private;
alter function public.create_friend_challenge(uuid, date, time without time zone, integer, text) set schema private;
alter function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) set schema private;
alter function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) set schema private;

revoke all on function private.claim_guest_ticket_booking(text, text) from public, anon, authenticated;
revoke all on function private.create_friend_challenge(uuid, date, time without time zone, integer, text) from public, anon, authenticated;
revoke all on function private.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function private.claim_guest_ticket_booking(text, text) to service_role;
grant execute on function private.create_friend_challenge(uuid, date, time without time zone, integer, text) to service_role;
grant execute on function private.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) to service_role;
grant execute on function private.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) to service_role;

create function public.claim_guest_ticket_booking(
  p_guest_phone text,
  p_ticket_reference text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
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

create function public.create_friend_challenge(
  p_target_profile_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_duration_minutes integer,
  p_game_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
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

create function public.join_private_session_with_code(
  p_session_id uuid,
  p_invite_code text,
  p_display_name text,
  p_avatar_url text default null,
  p_avatar_emoji text default null,
  p_avatar_initials text default null,
  p_avatar_color text default null,
  p_avatar_text_color text default null,
  p_profile_motto text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
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

create function public.join_private_session_waitlist_with_code(
  p_session_id uuid,
  p_invite_code text,
  p_display_name text,
  p_avatar_url text default null,
  p_avatar_emoji text default null,
  p_avatar_initials text default null,
  p_avatar_color text default null,
  p_avatar_text_color text default null,
  p_profile_motto text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
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

revoke all on function public.claim_guest_ticket_booking(text, text) from public, anon;
revoke all on function public.create_friend_challenge(uuid, date, time without time zone, integer, text) from public, anon;
revoke all on function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) from public, anon;

grant execute on function public.claim_guest_ticket_booking(text, text) to authenticated, service_role;
grant execute on function public.create_friend_challenge(uuid, date, time without time zone, integer, text) to authenticated, service_role;
grant execute on function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
