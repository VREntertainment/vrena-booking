begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select set_config(
  'request.jwt.claims',
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"service_role","is_anonymous":false}',
  true
);

insert into auth.users (id, email)
values
  ('41111111-1111-4111-8111-111111111111', 'database-security-owner@example.invalid'),
  ('42222222-2222-4222-8222-222222222222', 'database-security-attacker@example.invalid'),
  ('43333333-3333-4333-8333-333333333333', 'database-security-anonymous@example.invalid');

insert into public.profiles (id, email, full_name)
values
  ('41111111-1111-4111-8111-111111111111', 'database-security-owner@example.invalid', 'Database Security Owner'),
  ('42222222-2222-4222-8222-222222222222', 'database-security-attacker@example.invalid', 'Database Security Attacker'),
  ('43333333-3333-4333-8333-333333333333', 'database-security-anonymous@example.invalid', 'Database Security Anonymous')
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
values (
  '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '41111111-1111-4111-8111-111111111111',
  'Database security private fixture',
  current_date + 1,
  '10:00',
  4,
  'private',
  'SECURE-CODE',
  'community'
);

select ok(
  not has_table_privilege('anon', 'public.tournament_audit_log', 'insert')
    and not has_table_privilege('authenticated', 'public.tournament_audit_log', 'insert'),
  'browser roles cannot insert tournament audit rows directly'
);

select ok(
  not has_function_privilege('anon', 'public.log_tournament_audit(uuid,text,jsonb,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.log_tournament_audit(uuid,text,jsonb,jsonb)', 'execute'),
  'only signed-in users can reach the guarded tournament audit RPC'
);

select ok(
  has_function_privilege('anon', 'public.guest_ticket_phone_account_status(text)', 'execute')
    and has_function_privilege('authenticated', 'public.guest_ticket_phone_account_status(text)', 'execute')
    and not (
      select procedures.prosecdef
      from pg_proc procedures
      where procedures.oid = 'public.guest_ticket_phone_account_status(text)'::regprocedure
    )
    and position(
      'profile_has_account'
      in pg_get_functiondef('public.guest_ticket_phone_account_status(text)'::regprocedure)
    ) = 0,
  'the compatibility phone-status RPC cannot read account data'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text)',
    'execute'
  ),
  'the private-session join RPC is not exposed to unauthenticated requests'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text)',
    'execute'
  ),
  'the private waitlist RPC is not exposed to unauthenticated requests'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"43333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}',
  true
);

select is(
  (public.guest_ticket_phone_account_status('+84 901 234 567')->>'has_account')::boolean,
  false,
  'the compatibility RPC returns the same non-sensitive status for every valid phone'
);

select throws_ok(
  $$
    select public.join_private_session_with_code(
      '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'SECURE-CODE',
      'Anonymous attacker'
    )
  $$,
  'P0001',
  'A permanent account is required.',
  'an anonymous Auth user cannot join a private session'
);

select throws_ok(
  $$
    select public.join_private_session_waitlist_with_code(
      '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'SECURE-CODE',
      'Anonymous attacker'
    )
  $$,
  'P0001',
  'A permanent account is required.',
  'an anonymous Auth user cannot join a private waitlist'
);

select throws_ok(
  $$
    select public.log_tournament_audit(
      '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Forged audit entry',
      null,
      '{"forged":true}'::jsonb
    )
  $$,
  'P0001',
  'Not authorized to write this tournament audit entry.',
  'an anonymous Auth user cannot forge a tournament audit entry'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"42222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',
  true
);

select throws_ok(
  $$
    select public.log_tournament_audit(
      '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Cross-session audit entry',
      null,
      '{"forged":true}'::jsonb
    )
  $$,
  'P0001',
  'Not authorized to write this tournament audit entry.',
  'an unrelated permanent user cannot forge a tournament audit entry'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',
  true
);

select lives_ok(
  $$
    select public.log_tournament_audit(
      '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Legitimate owner audit entry',
      null,
      '{"secured":true}'::jsonb
    )
  $$,
  'the tournament owner can still write an audit entry'
);

select * from finish();
rollback;
