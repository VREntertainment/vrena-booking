do $migration$
declare
  function_oid oid;
  function_definition text;
begin
  for function_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'notify_google_sheets_session_insert',
        'notify_google_sheets_session_update'
      )
  loop
    function_definition := pg_get_functiondef(function_oid);
    if function_definition like '%https://vrena-booking.vercel.app%' then
      execute replace(
        function_definition,
        'https://vrena-booking.vercel.app',
        'https://booking.vre-vietnam.com'
      );
    end if;
  end loop;
end;
$migration$;
