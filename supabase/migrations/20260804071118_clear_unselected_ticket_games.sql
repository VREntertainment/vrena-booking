begin;

-- Ticket checkout currently uses an internal default game only for pricing,
-- discounts, and loyalty calculations. The customer does not choose a game,
-- so that internal calculation input must not be persisted as a real choice.
do $$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure
  )
  into v_definition;

  v_patched := replace(
    v_definition,
    E'    v_game_options,\n    jsonb_build_object(v_user_id::text, v_default_game),\n    v_default_game,',
    E'    array[]::text[],\n    ''{}''::jsonb,\n    null,'
  );

  if v_patched = v_definition then
    raise exception 'Could not clear unselected game values in create_ticket_booking.';
  end if;

  execute v_patched;

  select pg_get_functiondef(
    'public.create_guest_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure
  )
  into v_definition;

  v_patched := replace(
    v_definition,
    E'    v_game_options,\n    jsonb_build_object(v_customer_id::text, v_default_game),\n    v_default_game,',
    E'    array[]::text[],\n    ''{}''::jsonb,\n    null,'
  );

  if v_patched = v_definition then
    raise exception 'Could not clear unselected game values in create_guest_ticket_booking.';
  end if;

  execute v_patched;
end $$;

notify pgrst, 'reload schema';

commit;
