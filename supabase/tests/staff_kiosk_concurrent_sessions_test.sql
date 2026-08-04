begin;

select plan(4);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    not like '%revoked_reason = ''operator_switched''%',
  'unlocking a station does not revoke other active shared-account sessions'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    like '%insert into private.staff_kiosk_operator_sessions%',
  'each successful PIN unlock creates an independent operator session'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_touch_session(uuid,text)'::regprocedure)
    like '%and token_hash = p_token_hash%',
  'activity refresh remains scoped to the current station token'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_revoke_session(uuid,text,text)'::regprocedure)
    like '%and token_hash = p_token_hash%',
  'lock and logout remain scoped to the current station token'
);

select * from finish();

rollback;
