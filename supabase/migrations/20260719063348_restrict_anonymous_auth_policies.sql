begin;

-- Supabase anonymous Auth users assume the `authenticated` Postgres role.
-- VRena does not create anonymous Auth sessions: unauthenticated guest booking
-- uses the `anon` API role, while account features require a permanent user.
-- A restrictive policy therefore closes anonymous-Auth access without changing
-- any existing permissive policy or the public `anon` role's guest/read flows.
do $migration$
declare
  v_target text;
  v_schema text;
  v_table text;
begin
  foreach v_target in array array[
    'public.audit_logs',
    'public.blocked_times',
    'public.club_members',
    'public.club_messages',
    'public.clubs',
    'public.loyalty_point_transactions',
    'public.marketing_list',
    'public.pricing_rules',
    'public.profile_achievement_awards',
    'public.profile_achievement_unlock_views',
    'public.profiles',
    'public.push_events',
    'public.push_subscriptions',
    'public.session_invites',
    'public.session_messages',
    'public.session_participant_chapter_times',
    'public.session_participants',
    'public.session_waitlist',
    'public.sessions',
    'public.staff_attendance_approvals',
    'public.staff_attendance_logs',
    'public.staff_attendance_settings',
    'public.staff_check_in_locations',
    'public.staff_discount_rules',
    'public.staff_employee_profiles',
    'public.staff_games',
    'public.staff_hr_adjustments',
    'public.staff_hr_documents',
    'public.staff_hr_settings',
    'public.staff_hr_setup_options',
    'public.staff_leave_requests',
    'public.staff_loyalty_rules',
    'public.staff_order_payments',
    'public.staff_orders',
    'public.staff_payroll_items',
    'public.staff_payroll_runs',
    'public.staff_pricing_rules',
    'public.staff_schedule_shifts',
    'public.staff_zalo_settings',
    'public.tournament_editors',
    'public.tournament_matches',
    'public.tournament_pool_entries',
    'public.tournament_pools',
    'public.tournament_team_members',
    'public.tournament_teams',
    'public.user_follows',
    'storage.objects'
  ]
  loop
    v_schema := split_part(v_target, '.', 1);
    v_table := split_part(v_target, '.', 2);

    execute format(
      'drop policy if exists %I on %I.%I',
      'permanent accounts only',
      v_schema,
      v_table
    );

    execute format(
      $policy$
        create policy %I
        on %I.%I
        as restrictive
        for all
        to authenticated
        using (
          not coalesce(
            (select (auth.jwt() ->> 'is_anonymous')::boolean),
            false
          )
        )
        with check (
          not coalesce(
            (select (auth.jwt() ->> 'is_anonymous')::boolean),
            false
          )
        )
      $policy$,
      'permanent accounts only',
      v_schema,
      v_table
    );
  end loop;
end
$migration$;

notify pgrst, 'reload schema';

commit;
