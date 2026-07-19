begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select is(
  (
    select count(*)
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname in (
        'staff_set_updated_at',
        'staff_set_order_number',
        'push_session_body',
        'staff_role_rank',
        'profile_achievement_awards_touch_updated_at',
        'profile_achievement_unlock_views_touch_updated_at'
      )
      and procedures.proconfig = array['search_path=pg_catalog']
  ),
  6::bigint,
  'all advisor-reported functions use a fixed pg_catalog search path'
);

select is(
  (
    select count(*)
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname in (
        'can_manage_club_member',
        'can_manage_club_settings',
        'can_use_club_messages',
        'is_vrena_admin'
      )
      and has_function_privilege('anon', procedures.oid, 'execute')
  ),
  0::bigint,
  'anonymous callers cannot directly execute internal authorization helpers'
);

select is(
  (
    select count(*)
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname in (
        'can_manage_club_member',
        'can_manage_club_settings',
        'can_use_club_messages',
        'is_vrena_admin'
      )
      and has_function_privilege('authenticated', procedures.oid, 'execute')
  ),
  4::bigint,
  'authenticated policy evaluation retains access to authorization helpers'
);

select is(
  (
    select count(*)
    from pg_policies
    where (
      coalesce(qual, '') ~ '(can_manage_club_member|can_manage_club_settings|can_use_club_messages|is_vrena_admin)'
      or coalesce(with_check, '') ~ '(can_manage_club_member|can_manage_club_settings|can_use_club_messages|is_vrena_admin)'
    )
      and ('public' = any(roles) or 'anon' = any(roles))
  ),
  0::bigint,
  'policies that use internal authorization helpers exclude anonymous roles'
);

select is(
  (
    select count(*)
    from pg_policies
    where (schemaname, tablename, policyname) in (
      ('private', 'integration_settings', 'integration settings deny browser access'),
      ('public', 'bookings', 'bookings deny browser access'),
      ('public', 'message_translations', 'message translations deny browser access'),
      ('public', 'security_rate_limits', 'security rate limits deny browser access'),
      ('public', 'staff_zalo_attendance_events', 'staff Zalo attendance events deny browser access'),
      ('public', 'staff_zalo_identities', 'staff Zalo identities deny browser access')
    )
      and cmd = 'ALL'
      and 'anon' = any(roles)
      and 'authenticated' = any(roles)
      and qual = 'false'
      and with_check = 'false'
  ),
  6::bigint,
  'every service-only table has an explicit browser-role deny policy'
);

select is(
  (
    select count(*)
    from pg_class tables
    join pg_namespace namespaces on namespaces.oid = tables.relnamespace
    where (namespaces.nspname, tables.relname) in (
      ('private', 'integration_settings'),
      ('public', 'bookings'),
      ('public', 'message_translations'),
      ('public', 'security_rate_limits'),
      ('public', 'staff_zalo_attendance_events'),
      ('public', 'staff_zalo_identities')
    )
      and (
        has_table_privilege('anon', tables.oid, 'select')
        or has_table_privilege('anon', tables.oid, 'insert')
        or has_table_privilege('anon', tables.oid, 'update')
        or has_table_privilege('anon', tables.oid, 'delete')
        or has_table_privilege('authenticated', tables.oid, 'select')
        or has_table_privilege('authenticated', tables.oid, 'insert')
        or has_table_privilege('authenticated', tables.oid, 'update')
        or has_table_privilege('authenticated', tables.oid, 'delete')
      )
  ),
  0::bigint,
  'browser roles have no direct CRUD grants on service-only tables'
);

select is(
  (
    select count(*)
    from pg_class tables
    join pg_namespace namespaces on namespaces.oid = tables.relnamespace
    where (namespaces.nspname, tables.relname) in (
      ('private', 'integration_settings'),
      ('public', 'bookings'),
      ('public', 'message_translations'),
      ('public', 'security_rate_limits'),
      ('public', 'staff_zalo_attendance_events'),
      ('public', 'staff_zalo_identities')
    )
      and has_table_privilege('service_role', tables.oid, 'select')
      and has_table_privilege('service_role', tables.oid, 'insert')
      and has_table_privilege('service_role', tables.oid, 'update')
      and has_table_privilege('service_role', tables.oid, 'delete')
  ),
  6::bigint,
  'trusted service clients retain CRUD access to every service-only table'
);

select is(
  (
    select array_agg(
      format(
        '%I.%I(%s)',
        namespaces.nspname,
        procedures.proname,
        pg_get_function_identity_arguments(procedures.oid)
      )
      order by procedures.proname, pg_get_function_identity_arguments(procedures.oid)
    )
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.prosecdef
      and has_function_privilege('anon', procedures.oid, 'execute')
  ),
  array[
    'public.clubs_list_page()',
    'public.consume_booking_attempt_rate_limit(p_subject text)',
    'public.create_guest_ticket_booking(p_ticket_type text, p_date date, p_start_time time without time zone, p_duration_minutes integer, p_player_count integer, p_arena_count integer, p_game_options text[], p_unit_price integer, p_total_price integer, p_guest_phone text, p_guest_name text, p_guest_note text)',
    'public.get_leaderboard_players()',
    'public.get_leaderboard_players_page(p_limit integer, p_offset integer, p_search text, p_rank_by text, p_profile_id uuid, p_club_id uuid, p_club_pin text)',
    'public.session_detail(p_session_id uuid)',
    'public.sessions_list_page(p_start_date date, p_end_date date, p_limit integer, p_offset integer, p_include_blocked_times boolean)',
    'public.ticket_automatic_discount_quote(p_booking_date date, p_subtotal integer, p_unit_price integer, p_game_id text, p_player_count integer, p_start_time time without time zone, p_ticket_type text)',
    'public.ticket_loyalty_earn_quote(p_game_id text, p_booking_date date, p_paid_total integer, p_player_count integer)'
  ]::text[],
  'the anonymous SECURITY DEFINER surface matches the reviewed public RPC allowlist'
);

select * from finish();
rollback;
