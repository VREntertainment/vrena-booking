begin;

select plan(4);

select has_function(
  'public',
  'protect_minor_birthday_change',
  array[]::text[],
  'minor birthday protection function exists'
);

select is(
  (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_protect_minor_birthday'
      and not tgisinternal
  ),
  1::bigint,
  'profiles enforce the minor birthday lock before updates'
);

select ok(
  (
    select procedures.prosecdef
      and procedures.proconfig = array['search_path=pg_catalog']
      and pg_get_functiondef(procedures.oid) like '%auth.uid() = old.id%'
      and pg_get_functiondef(procedures.oid) like '%old.birthday > (current_date - interval ''18 years'')::date%'
    from pg_proc procedures
    where procedures.oid = 'public.protect_minor_birthday_change()'::regprocedure
  ),
  'the lock uses the saved birthday and the authenticated profile owner'
);

select ok(
  not has_function_privilege('anon', 'public.protect_minor_birthday_change()', 'execute')
  and not has_function_privilege('authenticated', 'public.protect_minor_birthday_change()', 'execute'),
  'browser roles cannot invoke the trigger helper directly'
);

select * from finish();

rollback;
