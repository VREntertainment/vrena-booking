begin;

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text)'::regprocedure)
  into v_definition;

  v_next_definition := regexp_replace(
    v_definition,
    '(p_discount_code text[^)]*)\)',
    E'\\1,\n  p_special_note text DEFAULT NULL::text\n)'
  );

  v_next_definition := replace(
    v_next_definition,
    'v_discount_source text := ''automatic'';',
    'v_discount_source text := ''automatic'';
  v_special_note text := left(nullif(btrim(coalesce(p_special_note, '''')), ''''), 500);'
  );

  v_next_definition := replace(
    v_next_definition,
    'if p_date is null or p_start_time is null or p_duration_minutes is null then',
    'if p_ticket_type = ''individual'' then
    v_special_note := null;
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then'
  );

  v_next_definition := replace(
    v_next_definition,
    '''Private ticket booking'',',
    'coalesce(v_special_note, ''Private ticket booking''),'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_ticket_booking with special ticket notes.';
  end if;

  execute v_next_definition;
end $$;

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_guest_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,text,text)'::regprocedure)
  into v_definition;

  v_next_definition := regexp_replace(
    v_definition,
    '(p_guest_name text[^)]*)\)',
    E'\\1,\n  p_guest_note text DEFAULT NULL::text\n)'
  );

  v_next_definition := replace(
    v_next_definition,
    'v_guest_name text := nullif(btrim(coalesce(p_guest_name, '''')), '''');',
    'v_guest_name text := nullif(btrim(coalesce(p_guest_name, '''')), '''');
  v_guest_note text := left(nullif(btrim(coalesce(p_guest_note, '''')), ''''), 500);'
  );

  v_next_definition := replace(
    v_next_definition,
    'if p_date is null or p_start_time is null or p_duration_minutes is null then',
    'if p_ticket_type = ''individual'' then
    v_guest_note := null;
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then'
  );

  v_next_definition := replace(
    v_next_definition,
    '''Guest ticket booking'',',
    'coalesce(v_guest_note, ''Guest ticket booking''),'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_guest_ticket_booking with special ticket notes.';
  end if;

  execute v_next_definition;
end $$;

drop function if exists public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer, text);
drop function if exists public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text);

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer, text, text) from public, anon;
revoke all on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text, text) from public, anon;

grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer, text, text) to authenticated;
grant execute on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
