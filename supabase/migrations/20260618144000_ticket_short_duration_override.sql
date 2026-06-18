-- Allow customer-selected ticket durations below the recommendation.
-- Pricing still uses reserved arena capacity through v_charged_player_spots.

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
    '  if p_duration_minutes < v_expected_duration then
    raise exception ''Ticket duration is below the minimum for this player count.'';
  end if;',
    '  -- Customers may choose a shorter duration than the recommended group time.
  -- The client shows a playtime disclaimer, while price validation still charges
  -- at least the recommended reserved capacity via v_charged_player_spots.'
  );

  if v_function_definition = v_previous_definition then
    raise exception 'Expected ticket duration minimum validation block was not found.';
  end if;

  execute v_function_definition;
end;
$$;

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) from public, anon;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) to authenticated;
