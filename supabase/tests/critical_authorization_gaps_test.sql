begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"service_role","is_anonymous":false}',
  true
);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'security-owner@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'security-attacker@example.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'security-victim@example.invalid');

insert into public.profiles (id, email, full_name)
values
  ('11111111-1111-4111-8111-111111111111', 'security-owner@example.invalid', 'Security Owner'),
  ('22222222-2222-4222-8222-222222222222', 'security-attacker@example.invalid', 'Security Attacker'),
  ('33333333-3333-4333-8333-333333333333', 'security-victim@example.invalid', 'Security Victim')
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name;

insert into public.sessions (
  id,
  owner_id,
  name,
  date,
  start_time,
  max_players,
  visibility,
  invite_code,
  booking_type
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'Private security fixture',
    current_date + 1,
    '10:00',
    4,
    'private',
    'SECRET-CODE',
    'community'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111',
    'Public security fixture',
    current_date + 1,
    '11:00',
    4,
    'public',
    null,
    'community'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '11111111-1111-4111-8111-111111111111',
    'Full security fixture',
    current_date + 1,
    '12:00',
    1,
    'public',
    null,
    'community'
  );

insert into public.session_participants (session_id, profile_id, display_name)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111',
  'Security Owner'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"security-attacker@example.invalid","is_anonymous":false}',
  true
);

select is(
  (select count(*) from public.sessions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'an unrelated user cannot read a private session or its invite code'
);

select is(
  (select count(*) from public.session_participants where session_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  0::bigint,
  'an unrelated user cannot read another participant payment/profile row'
);

select lives_ok(
  $$
    insert into public.session_participants (session_id, profile_id, display_name)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '22222222-2222-4222-8222-222222222222',
      'Security Attacker'
    )
  $$,
  'a signed-in user can still join an available public session as themselves'
);

select throws_ok(
  $$
    insert into public.session_participants (session_id, profile_id, display_name)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '33333333-3333-4333-8333-333333333333',
      'Forged Victim'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "session_participants"',
  'a user cannot join a session under another profile id'
);

select throws_ok(
  $$
    insert into public.session_participants (session_id, profile_id, display_name)
    values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '22222222-2222-4222-8222-222222222222',
      'Overflow Attacker'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "session_participants"',
  'a user cannot bypass session capacity with a direct insert'
);

select lives_ok(
  $$
    insert into public.sessions (
      id,
      owner_id,
      name,
      date,
      start_time,
      visibility,
      booking_type
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '22222222-2222-4222-8222-222222222222',
      'Legitimate community session',
      current_date + 2,
      '13:00',
      'public',
      'community'
    )
  $$,
  'a signed-in user can still create their own community session'
);

select throws_ok(
  $$
    update public.sessions
    set booking_type = 'ticket',
        ticket_status = 'confirmed',
        ticket_total_price = 100000
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  $$,
  'P0001',
  'Ticket booking fields can only be changed by staff.',
  'a community owner cannot forge a trusted ticket booking'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_rate_limit(text,integer,integer,text)',
    'execute'
  ),
  'authenticated clients cannot choose arbitrary rate-limit configuration'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.consume_login_attempt_rate_limit(text)',
    'execute'
  ),
  'anonymous callers cannot lock another email out through the legacy login wrapper'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sessions', 'session_participants', 'bookings')
      and (
        coalesce(qual, '') = 'true'
        or coalesce(with_check, '') = 'true'
        or 'anon' = any(roles)
        or 'public' = any(roles)
      )
  ),
  0::bigint,
  'no unconditional or anonymous session/booking policy remains'
);

select ok(
  case
    when to_regclass('public.bookings') is null then true
    else not has_table_privilege('anon', 'public.bookings', 'select')
      and not has_table_privilege('anon', 'public.bookings', 'insert')
      and not has_table_privilege('authenticated', 'public.bookings', 'select')
  end,
  'the legacy bookings PII table is not exposed to browser roles'
);

select * from finish();
rollback;
