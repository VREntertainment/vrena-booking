begin;

select plan(11);

select has_function(
  'public',
  'staff_get_player_achievement_history',
  array['uuid'],
  'staff history RPC exists'
);

select has_function(
  'public',
  'staff_save_player_achievement_profile',
  array['uuid', 'integer', 'jsonb', 'jsonb', 'jsonb', 'text'],
  'atomic staff save RPC exists'
);

select has_function(
  'public',
  'staff_list_player_session_options',
  array['uuid', 'date'],
  'staff session calendar RPC exists'
);

select has_function(
  'public',
  'staff_save_player_achievement_profile_v2',
  array['uuid', 'integer', 'jsonb', 'jsonb', 'jsonb', 'text', 'uuid[]'],
  'atomic staff save RPC with queued sessions exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.staff_get_player_achievement_history(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.staff_save_player_achievement_profile(uuid,integer,jsonb,jsonb,jsonb,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.staff_list_player_session_options(uuid,date)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.staff_save_player_achievement_profile_v2(uuid,integer,jsonb,jsonb,jsonb,text,uuid[])',
    'execute'
  ),
  'anonymous callers cannot use the staff profile RPCs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.staff_get_player_achievement_history(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.staff_save_player_achievement_profile(uuid,integer,jsonb,jsonb,jsonb,text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.staff_list_player_session_options(uuid,date)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.staff_save_player_achievement_profile_v2(uuid,integer,jsonb,jsonb,jsonb,text,uuid[])',
    'execute'
  ),
  'authenticated callers can reach the internally authorized staff RPCs'
);

select ok(
  (
    select procedures.prosecdef
      and pg_get_functiondef(procedures.oid) like '%current_staff_role_rank()%'
    from pg_proc procedures
    where procedures.oid = 'public.staff_get_player_achievement_history(uuid)'::regprocedure
  ),
  'staff history RPC is a rank-checked security definer'
);

select ok(
  (
    select procedures.prosecdef
      and pg_get_functiondef(procedures.oid) like '%staff_save_player_achievement_profile_v2(%'
    from pg_proc procedures
    where procedures.oid = 'public.staff_save_player_achievement_profile(uuid,integer,jsonb,jsonb,jsonb,text)'::regprocedure
  ),
  'legacy staff save RPC delegates to the current atomic workflow'
);

select ok(
  (
    select procedures.prosecdef
      and pg_get_functiondef(procedures.oid) like '%current_staff_role_rank()%'
      and pg_get_functiondef(procedures.oid) like '%alreadyAdded%'
      and pg_get_functiondef(procedures.oid) like '%session_participants%'
    from pg_proc procedures
    where procedures.oid = 'public.staff_list_player_session_options(uuid,date)'::regprocedure
  ),
  'staff session calendar is rank checked and reports existing membership'
);

select ok(
  (
    select procedures.prosecdef
      and pg_get_functiondef(procedures.oid) like '%staff_set_player_stat_overrides(%'
      and pg_get_functiondef(procedures.oid) like '%staff_upsert_session_participant_result_v2(%'
      and pg_get_functiondef(procedures.oid) like '%cardinality(p_session_ids)%'
      and pg_get_functiondef(procedures.oid) like '%player_achievement_profile_updated%'
      and pg_get_functiondef(procedures.oid) like '%audit_logs%'
    from pg_proc procedures
    where procedures.oid = 'public.staff_save_player_achievement_profile_v2(uuid,integer,jsonb,jsonb,jsonb,text,uuid[])'::regprocedure
  ),
  'current staff save composes stats, achievements, and sessions in one transaction'
);

select ok(
  (
    select pg_get_functiondef(procedures.oid) like '%' || quote_literal('sessions') || '%'
      and pg_get_functiondef(procedures.oid) like '%v_before_sessions%'
      and pg_get_functiondef(procedures.oid) like '%v_after_sessions%'
    from pg_proc procedures
    where procedures.oid = 'public.staff_save_player_achievement_profile_v2(uuid,integer,jsonb,jsonb,jsonb,text,uuid[])'::regprocedure
  ),
  'staff save audit records previous and new session membership'
);

select * from finish();

rollback;
