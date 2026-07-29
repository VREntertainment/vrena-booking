begin;

select plan(6);

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
      and pg_get_functiondef(procedures.oid) like '%staff_set_player_stat_overrides(%'
      and pg_get_functiondef(procedures.oid) like '%player_achievement_profile_updated%'
      and pg_get_functiondef(procedures.oid) like '%audit_logs%'
    from pg_proc procedures
    where procedures.oid = 'public.staff_save_player_achievement_profile(uuid,integer,jsonb,jsonb,jsonb,text)'::regprocedure
  ),
  'staff save RPC composes stats and achievement changes with one audit record'
);

select * from finish();

rollback;
