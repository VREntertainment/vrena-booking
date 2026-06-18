-- Ticket pricing must follow the customer-selected reserved duration.
-- Recommended minimums still drive UI guidance, but not the charged capacity.

do $$
declare
  v_function_definition text;
  v_previous_definition text;
begin
  select pg_get_functiondef(
    'public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer)'::regprocedure
  )
  into v_function_definition;

  if v_function_definition is null then
    raise exception 'create_ticket_booking function was not found.';
  end if;

  v_previous_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    'v_charged_player_spots := greatest(v_required_slots, ceil(p_duration_minutes::numeric / 20)::integer) * 4;',
    'v_charged_player_spots := greatest(1, ceil(p_duration_minutes::numeric / 20)::integer) * 4;'
  );

  if v_function_definition = v_previous_definition then
    raise exception 'Expected ticket charged capacity rule was not found.';
  end if;

  execute v_function_definition;
end;
$$;

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) from public, anon;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) to authenticated;
