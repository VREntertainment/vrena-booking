begin;

-- Emit TAP directly so the same test runs through local pgTAP installations
-- and the linked test runner, whose temporary extension schema can differ.
select '1..10';

select case when (
  select count(*) = 21
  from pg_proc procedures
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where namespaces.nspname = 'private'
    and procedures.proname in (
      'can_insert_club_member_row',
      'can_join_session_row',
      'can_manage_avatar_object_path',
      'can_manage_club_banner_path',
      'can_manage_club_member',
      'can_manage_club_settings',
      'can_manage_session_row',
      'can_manage_staff_game_image_path',
      'can_manage_staff_hr_document_path',
      'can_manage_tournament',
      'can_read_club_member_row',
      'can_read_staff_attendance_row',
      'can_read_staff_attendance_settings',
      'can_read_staff_hr_document_path',
      'can_use_club_messages',
      'can_view_session_row',
      'is_staff_attendance_editor',
      'is_staff_console_user',
      'is_vrena_admin',
      'is_vrena_owner',
      'owns_tournament'
    )
    and procedures.prosecdef
    and has_function_privilege('authenticated', procedures.oid, 'execute')
) then
  'ok 1 - all RLS helper implementations are privileged functions in the private schema'
else
  'not ok 1 - all RLS helper implementations are privileged functions in the private schema'
end;

select case when (
  select count(*) = 21
  from pg_proc procedures
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where namespaces.nspname = 'public'
    and procedures.proname in (
      'can_insert_club_member_row',
      'can_join_session_row',
      'can_manage_avatar_object_path',
      'can_manage_club_banner_path',
      'can_manage_club_member',
      'can_manage_club_settings',
      'can_manage_session_row',
      'can_manage_staff_game_image_path',
      'can_manage_staff_hr_document_path',
      'can_manage_tournament',
      'can_read_club_member_row',
      'can_read_staff_attendance_row',
      'can_read_staff_attendance_settings',
      'can_read_staff_hr_document_path',
      'can_use_club_messages',
      'can_view_session_row',
      'is_staff_attendance_editor',
      'is_staff_console_user',
      'is_vrena_admin',
      'is_vrena_owner',
      'owns_tournament'
    )
    and not procedures.prosecdef
    and not has_function_privilege('authenticated', procedures.oid, 'execute')
) then
  'ok 2 - public RLS-helper shims are non-privileged and unavailable to clients'
else
  'not ok 2 - public RLS-helper shims are non-privileged and unavailable to clients'
end;

select case when not exists (
  select 1
  from pg_policies
  where coalesce(qual, '') ~ 'public[.](can_insert_club_member_row|can_join_session_row|can_manage_avatar_object_path|can_manage_club_banner_path|can_manage_club_member|can_manage_club_settings|can_manage_session_row|can_manage_staff_game_image_path|can_manage_staff_hr_document_path|can_manage_tournament|can_read_club_member_row|can_read_staff_attendance_row|can_read_staff_attendance_settings|can_read_staff_hr_document_path|can_use_club_messages|can_view_session_row|is_staff_attendance_editor|is_staff_console_user|is_vrena_admin|is_vrena_owner|owns_tournament)'
     or coalesce(with_check, '') ~ 'public[.](can_insert_club_member_row|can_join_session_row|can_manage_avatar_object_path|can_manage_club_banner_path|can_manage_club_member|can_manage_club_settings|can_manage_session_row|can_manage_staff_game_image_path|can_manage_staff_hr_document_path|can_manage_tournament|can_read_club_member_row|can_read_staff_attendance_row|can_read_staff_attendance_settings|can_read_staff_hr_document_path|can_use_club_messages|can_view_session_row|is_staff_attendance_editor|is_staff_console_user|is_vrena_admin|is_vrena_owner|owns_tournament)'
) then
  'ok 3 - RLS policies no longer depend on exposed public helper implementations'
else
  'not ok 3 - RLS policies no longer depend on exposed public helper implementations'
end;

select case when
  not (
    select procedures.prosecdef
    from pg_proc procedures
    where procedures.oid = 'public.consume_rate_limit(text,integer,integer,text)'::regprocedure
  )
  and not has_function_privilege(
    'authenticated',
    'public.consume_rate_limit(text,integer,integer,text)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.consume_rate_limit(text,integer,integer,text)',
    'execute'
  )
then
  'ok 4 - the generic rate-limit primitive is a service-only non-definer endpoint'
else
  'not ok 4 - the generic rate-limit primitive is a service-only non-definer endpoint'
end;

select case when
  not has_function_privilege('authenticated', 'public.current_staff_role_key()', 'execute')
  and has_function_privilege('authenticated', 'public.current_staff_role_rank()', 'execute')
then
  'ok 5 - the internal role key is hidden while the reviewed rank API remains available'
else
  'not ok 5 - the internal role key is hidden while the reviewed rank API remains available'
end;

select case when (
  select count(*) = 4
  from pg_proc procedures
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where namespaces.nspname = 'public'
    and procedures.proname in (
      'claim_guest_ticket_booking',
      'create_friend_challenge',
      'join_private_session_with_code',
      'join_private_session_waitlist_with_code'
    )
    and procedures.prosecdef
    and has_function_privilege('authenticated', procedures.oid, 'execute')
    and pg_get_functiondef(procedures.oid) like '%public.consume_rate_limit(%'
) then
  'ok 6 - sensitive authenticated RPCs enforce rate limits inside the database boundary'
else
  'not ok 6 - sensitive authenticated RPCs enforce rate limits inside the database boundary'
end;

select case when (
  select count(*) = 2
  from pg_proc procedures
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where namespaces.nspname = 'public'
    and procedures.proname in ('claim_guest_ticket_booking', 'create_friend_challenge')
    and pg_get_functiondef(procedures.oid) like '%is_anonymous%'
) then
  'ok 7 - account-link and challenge RPCs reject anonymous Auth users'
else
  'not ok 7 - account-link and challenge RPCs reject anonymous Auth users'
end;

select case when (
  select array_agg(
    procedures.oid::regprocedure::text
    order by procedures.proname, pg_get_function_identity_arguments(procedures.oid)
  )
  from pg_proc procedures
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where namespaces.nspname = 'public'
    and procedures.prosecdef
    and has_function_privilege('authenticated', procedures.oid, 'execute')
) = array[
  'claim_guest_ticket_booking(text,text)',
  'clubs_list_page()',
  'consume_booking_attempt_rate_limit(text)',
  'consume_user_action_rate_limit(text,text)',
  'create_friend_challenge(uuid,date,time without time zone,integer,text)',
  'create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)',
  'create_staff_order_with_payments(uuid,text,text,text,uuid,date,time without time zone,integer,text,uuid,text,boolean,text,text,text,text,text,text,numeric,jsonb)',
  'create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)',
  'current_staff_role_rank()',
  'get_leaderboard_players()',
  'get_leaderboard_players_page(integer,integer,text,text,uuid,uuid,text)',
  'get_soft_deleted_records(integer)',
  'get_staff_daily_report(date,date,date,date,integer)',
  'join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text)',
  'join_private_session_with_code(uuid,text,text,text,text,text,text,text,text)',
  'log_tournament_audit(uuid,text,jsonb,jsonb)',
  'profile_search(text,integer,integer,text,boolean,text)',
  'public_profile_search(text,integer)',
  'restore_soft_deleted_record(text,uuid)',
  'session_detail(uuid)',
  'sessions_list_page(date,date,integer,integer,boolean)',
  'set_session_participant_chapter_time(uuid,text,integer,integer)',
  'set_staff_profile_role(uuid,text)',
  'soft_delete_record(text,uuid,text)',
  'soft_delete_tournament_records(uuid,boolean,text)',
  'staff_approve_attendance_period(date,date)',
  'staff_award_profile_achievement(uuid,text,text,text,text,text)',
  'staff_delete_profile_account(uuid,text,boolean,text,text)',
  'staff_delete_session_operation(uuid,text)',
  'staff_orders_page(date,date,integer,integer,text,text)',
  'staff_remove_session_participant_operation(uuid,uuid)',
  'staff_report_summary(date,date,date,date,integer)',
  'staff_sync_payroll_draft(date,boolean)',
  'staff_update_session_operation(uuid,text,date,time without time zone,integer,integer,integer,text,text,text)',
  'staff_upsert_session_participant_operation(uuid,uuid,uuid,text,boolean,text,integer,integer,double precision,integer,integer,integer)',
  'sync_profile_public_snapshot(uuid)',
  'ticket_automatic_discount_quote(date,integer,integer,text,integer,time without time zone,text)',
  'ticket_discount_code_quote(text,date,integer,integer,text,integer,time without time zone,text)',
  'ticket_loyalty_earn_quote(text,date,integer,integer)',
  'ticket_loyalty_redemption_settings(text,date)',
  'ticket_loyalty_redemption_settings(text,date,integer,integer)',
  'transfer_club_ownership(uuid,uuid)'
]::text[] then
  'ok 8 - authenticated SECURITY DEFINER functions match the reviewed allowlist'
else
  'not ok 8 - authenticated SECURITY DEFINER functions match the reviewed allowlist'
end;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',
  true
);

with policy_probe as materialized (
  select count(*) as visible_sessions
  from public.sessions
)
select case when visible_sessions >= 0 then
  'ok 9 - authenticated session reads still evaluate policies backed by private helpers'
else
  'not ok 9 - authenticated session reads still evaluate policies backed by private helpers'
end
from policy_probe;

do $test$
begin
  begin
    perform public.consume_rate_limit('booking_attempt', 1, 60, 'forged');
    raise exception 'generic rate-limit RPC unexpectedly executable';
  exception
    when insufficient_privilege then null;
  end;
end
$test$;

select 'ok 10 - authenticated callers cannot invoke the generic rate-limit primitive';

rollback;
