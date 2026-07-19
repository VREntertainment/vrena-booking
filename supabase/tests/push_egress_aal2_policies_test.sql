begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"service_role","is_anonymous":false}',
  true
);

insert into auth.users (id, email)
values
  ('51111111-1111-4111-8111-111111111111', 'push-owner@example.invalid'),
  ('52222222-2222-4222-8222-222222222222', 'aal2-admin@example.invalid'),
  ('53333333-3333-4333-8333-333333333333', 'message-author@example.invalid');

insert into public.profiles (id, email, full_name, role)
values
  ('51111111-1111-4111-8111-111111111111', 'push-owner@example.invalid', 'Push Owner', 'player'),
  ('52222222-2222-4222-8222-222222222222', 'aal2-admin@example.invalid', 'AAL2 Admin', 'admin'),
  ('53333333-3333-4333-8333-333333333333', 'message-author@example.invalid', 'Message Author', 'player')
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role;

insert into auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  created_at,
  updated_at,
  secret
) values (
  '52ffffff-ffff-4fff-8fff-ffffffffffff',
  '52222222-2222-4222-8222-222222222222',
  'Security fixture',
  'totp',
  'verified',
  now(),
  now(),
  'SECURITY-FIXTURE-ONLY'
);

insert into public.sessions (
  id,
  owner_id,
  name,
  date,
  start_time,
  max_players,
  visibility,
  booking_type
) values (
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '51111111-1111-4111-8111-111111111111',
  'AAL2 message fixture',
  current_date + 1,
  '10:00',
  4,
  'public',
  'community'
);

insert into public.session_messages (
  id,
  session_id,
  author_id,
  author_display_name,
  body,
  moderation_status
) values
  (
    '5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '53333333-3333-4333-8333-333333333333',
    'Message Author',
    'Pending AAL2 fixture',
    'pending'
  ),
  (
    '5ccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '53333333-3333-4333-8333-333333333333',
    'Message Author',
    'Delete AAL2 fixture',
    'pending'
  );

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'users create own push subscriptions'
      and position('apple' in coalesce(with_check, '')) > 0
      and position('mozilla' in coalesce(with_check, '')) > 0
      and position('windows' in coalesce(with_check, '')) > 0
  ),
  'push subscription inserts enforce the provider allowlist'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_messages'
      and (
        coalesce(qual, '') ~* '(profiles[.]role|lower[(]profiles[.]email|emile@vre-vietnam[.]com)'
        or coalesce(with_check, '') ~* '(profiles[.]role|lower[(]profiles[.]email|emile@vre-vietnam[.]com)'
      )
  ),
  0::bigint,
  'session-message policies no longer trust legacy profile predicates'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated","email":"push-owner@example.invalid","aal":"aal1","is_anonymous":false}',
  true
);

select lives_ok(
  $$
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
    values (
      '51111111-1111-4111-8111-111111111111',
      'https://web.push.apple.com/VALID-TOKEN',
      'p256dh-fixture',
      'auth-fixture'
    )
  $$,
  'a recognized Apple Web Push subscription remains valid'
);

select throws_ok(
  $$
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
    values (
      '51111111-1111-4111-8111-111111111111',
      'https://169.254.169.254/latest/meta-data',
      'p256dh-fixture',
      'auth-fixture'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "push_subscriptions"',
  'a private-network HTTPS endpoint cannot be registered'
);

select throws_ok(
  $$
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
    values (
      '51111111-1111-4111-8111-111111111111',
      'https://web.push.apple.com.evil.example/push',
      'p256dh-fixture',
      'auth-fixture'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "push_subscriptions"',
  'a deceptive push-provider hostname cannot be registered'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated","email":"aal2-admin@example.invalid","aal":"aal1","is_anonymous":false}',
  true
);

select is(
  public.current_staff_role_rank(),
  0,
  'an AAL1 admin receives no staff rank'
);

select is(
  (
    select count(*)
    from public.session_messages
    where id = '5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  0::bigint,
  'an AAL1 admin cannot read a pending session message'
);

select results_eq(
  $$
    delete from public.session_messages
    where id = '5ccccccc-cccc-4ccc-8ccc-cccccccccccc'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'an AAL1 admin cannot delete the protected message'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated","email":"aal2-admin@example.invalid","aal":"aal2","is_anonymous":false}',
  true
);

select is(
  public.current_staff_role_rank(),
  100,
  'a verified AAL2 admin retains the admin rank'
);

select is(
  (
    select count(*)
    from public.session_messages
    where id in (
      '5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '5ccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  ),
  2::bigint,
  'a verified AAL2 admin can read pending session messages'
);

select results_eq(
  $$
    update public.session_messages
    set moderation_status = 'approved',
        reviewed_by = '52222222-2222-4222-8222-222222222222',
        reviewed_at = now()
    where id = '5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning moderation_status
  $$,
  $$ values ('approved'::text) $$,
  'a verified AAL2 admin can still review a session message'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated","email":"push-owner@example.invalid","aal":"aal1","is_anonymous":false}',
  true
);

select is(
  (
    select count(*)
    from public.session_messages
    where id = '5ccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  1::bigint,
  'the AAL1 session owner can still read a pending message in their session'
);

select results_eq(
  $$
    update public.session_messages
    set moderation_status = 'approved',
        reviewed_by = '51111111-1111-4111-8111-111111111111',
        reviewed_at = now()
    where id = '5ccccccc-cccc-4ccc-8ccc-cccccccccccc'
    returning moderation_status
  $$,
  $$ values ('approved'::text) $$,
  'the AAL1 session owner can still review their session message'
);

select * from finish();
rollback;
