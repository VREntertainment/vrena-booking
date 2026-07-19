begin;

create temporary table expected_anonymous_auth_guards (
  schema_name text not null,
  table_name text not null,
  primary key (schema_name, table_name)
) on commit drop;

insert into expected_anonymous_auth_guards (schema_name, table_name)
values
  ('public', 'audit_logs'),
  ('public', 'blocked_times'),
  ('public', 'club_members'),
  ('public', 'club_messages'),
  ('public', 'clubs'),
  ('public', 'loyalty_point_transactions'),
  ('public', 'marketing_list'),
  ('public', 'pricing_rules'),
  ('public', 'profile_achievement_awards'),
  ('public', 'profile_achievement_unlock_views'),
  ('public', 'profiles'),
  ('public', 'push_events'),
  ('public', 'push_subscriptions'),
  ('public', 'session_invites'),
  ('public', 'session_messages'),
  ('public', 'session_participant_chapter_times'),
  ('public', 'session_participants'),
  ('public', 'session_waitlist'),
  ('public', 'sessions'),
  ('public', 'staff_attendance_approvals'),
  ('public', 'staff_attendance_logs'),
  ('public', 'staff_attendance_settings'),
  ('public', 'staff_check_in_locations'),
  ('public', 'staff_discount_rules'),
  ('public', 'staff_employee_profiles'),
  ('public', 'staff_games'),
  ('public', 'staff_hr_adjustments'),
  ('public', 'staff_hr_documents'),
  ('public', 'staff_hr_settings'),
  ('public', 'staff_hr_setup_options'),
  ('public', 'staff_leave_requests'),
  ('public', 'staff_loyalty_rules'),
  ('public', 'staff_order_payments'),
  ('public', 'staff_orders'),
  ('public', 'staff_payroll_items'),
  ('public', 'staff_payroll_runs'),
  ('public', 'staff_pricing_rules'),
  ('public', 'staff_schedule_shifts'),
  ('public', 'staff_zalo_settings'),
  ('public', 'tournament_editors'),
  ('public', 'tournament_matches'),
  ('public', 'tournament_pool_entries'),
  ('public', 'tournament_pools'),
  ('public', 'tournament_team_members'),
  ('public', 'tournament_teams'),
  ('public', 'user_follows'),
  ('storage', 'objects');

select '1..8';

select case when
  (select count(*) from expected_anonymous_auth_guards) = 47
  and (
    select count(*)
    from expected_anonymous_auth_guards expected
    join pg_policies policies
      on policies.schemaname = expected.schema_name
     and policies.tablename = expected.table_name
     and policies.policyname = 'permanent accounts only'
  ) = 47
  and (
    select count(*)
    from pg_policies
    where policyname = 'permanent accounts only'
  ) = 47
then
  'ok 1 - the permanent-account guard covers exactly the 47 application and storage tables'
else
  'not ok 1 - the permanent-account guard covers exactly the 47 application and storage tables'
end;

select case when (
  select count(*)
  from expected_anonymous_auth_guards expected
  join pg_policies policies
    on policies.schemaname = expected.schema_name
   and policies.tablename = expected.table_name
   and policies.policyname = 'permanent accounts only'
  where policies.permissive = 'RESTRICTIVE'
    and policies.cmd = 'ALL'
    and policies.roles = array['authenticated'::name]
    and position('is_anonymous' in coalesce(policies.qual, '')) > 0
    and position('is_anonymous' in coalesce(policies.with_check, '')) > 0
) = 47 then
  'ok 2 - every guard is restrictive and checks anonymous Auth on old and new rows'
else
  'not ok 2 - every guard is restrictive and checks anonymous Auth on old and new rows'
end;

select case when not exists (
  select 1
  from pg_policies
  where policyname = 'permanent accounts only'
    and schemaname in ('auth', 'cron')
) then
  'ok 3 - managed auth and cron schemas remain untouched'
else
  'not ok 3 - managed auth and cron schemas remain untouched'
end;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"72222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":true}',
  true
);
select set_config('test.anonymous_profile_insert_blocked', 'false', true);

do $test$
begin
  begin
    insert into public.profiles (id, email, full_name)
    values (
      '72222222-2222-4222-8222-222222222222',
      'anonymous-guard-anon@example.invalid',
      'Anonymous Guard Anonymous User'
    );
  exception
    when insufficient_privilege then
      perform set_config('test.anonymous_profile_insert_blocked', 'true', true);
    when others then
      -- Before the guard, the insert passes RLS and reaches a later constraint.
      perform set_config('test.anonymous_profile_insert_blocked', 'false', true);
  end;
end
$test$;

select case when current_setting('test.anonymous_profile_insert_blocked') = 'true' then
  'ok 4 - an anonymous Auth user cannot create an application profile'
else
  'not ok 4 - an anonymous Auth user cannot create an application profile'
end;

select case when (
  select count(*) from public.clubs
) = 0 then
  'ok 5 - an anonymous Auth user cannot read application tables'
else
  'not ok 5 - an anonymous Auth user cannot read application tables'
end;

select set_config(
  'request.jwt.claims',
  '{"sub":"73333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('test.permanent_profile_policy_passed', 'false', true);

do $test$
begin
  begin
    insert into public.profiles (id, email, full_name)
    values (
      '73333333-3333-4333-8333-333333333333',
      'anonymous-guard-permanent@example.invalid',
      'Anonymous Guard Permanent User'
    );
    perform set_config('test.permanent_profile_policy_passed', 'true', true);
  exception
    when foreign_key_violation then
      -- Reaching the FK proves the permanent account passed the RLS guard.
      perform set_config('test.permanent_profile_policy_passed', 'true', true);
    when insufficient_privilege then
      perform set_config('test.permanent_profile_policy_passed', 'false', true);
  end;
end
$test$;

select case when current_setting('test.permanent_profile_policy_passed') = 'true' then
  'ok 6 - a permanent account still passes the own-profile RLS boundary'
else
  'not ok 6 - a permanent account still passes the own-profile RLS boundary'
end;

select case when exists (select 1 from public.clubs) then
  'ok 7 - permanent-account public-read behavior remains intact'
else
  'not ok 7 - permanent-account public-read behavior remains intact'
end;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select case when exists (select 1 from public.clubs_list_page()) then
  'ok 8 - the public anon-role club listing remains intact'
else
  'not ok 8 - the public anon-role club listing remains intact'
end;

rollback;
