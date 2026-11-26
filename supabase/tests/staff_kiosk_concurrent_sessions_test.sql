begin;

select plan(6);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    not like '%revoked_reason = ''operator_switched''%',
  'unlocking a station does not revoke other active shared-account sessions'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    like '%v_attempt_hash text := repeat(''0''%'
    and pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
      like '%user_agent_hash = v_attempt_hash%',
  'PIN failures use one shared-account bucket instead of caller-controlled User-Agent buckets'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    like '%insert into private.staff_kiosk_operator_sessions%',
  'each successful PIN unlock creates an independent operator session'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_touch_session(uuid,text)'::regprocedure)
    like '%s.token_hash = p_token_hash%'
    and pg_get_functiondef('public.staff_kiosk_touch_session(uuid,text)'::regprocedure)
      like '%s.auth_user_id = p_actor_user_id%',
  'activity refresh remains scoped to the current station token and account'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_revoke_session(uuid,text,text)'::regprocedure)
    like '%and token_hash = p_token_hash%',
  'lock and logout remain scoped to the current station token'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    like '%employee.contract_end_date >= (now() at time zone ''Asia/Ho_Chi_Minh'')::date%'
    and pg_get_functiondef('public.staff_kiosk_touch_session(uuid,text)'::regprocedure)
      like '%e.contract_end_date >= (now() at time zone ''Asia/Ho_Chi_Minh'')::date%'
    and pg_get_functiondef('private.current_staff_kiosk_session_id()'::regprocedure)
      like '%employee.contract_end_date >= (now() at time zone ''Asia/Ho_Chi_Minh'')::date%',
  'contract end date applies to PIN unlock, activity refresh, and current operator access'
);

select * from finish();

rollback;
