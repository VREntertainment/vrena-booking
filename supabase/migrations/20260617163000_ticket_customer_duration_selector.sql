-- Allow customer-selected ticket durations from the minimum up to 120 minutes.
-- Prices continue to use reserved arena capacity: duration blocks * 4 spots.

do $$
declare
  v_function_definition text;
  v_previous_definition text;
  v_duration_rule_definition text;
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
    'p_duration_minutes > 240',
    'p_duration_minutes > 120'
  );

  if position('p_duration_minutes > 120' in v_function_definition) = 0 then
    raise exception 'Expected ticket duration maximum rule was not found.';
  end if;

  v_duration_rule_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    '  if p_player_count > 12 then
    if p_duration_minutes < v_expected_duration then
      raise exception ''Ticket duration must be at least 60 minutes for 13-16 players.'';
    end if;
  elsif p_duration_minutes <> v_expected_duration then
    raise exception ''Ticket duration does not match one-arena capacity for this player count.'';
  end if;',
    '  if p_duration_minutes < v_expected_duration then
    raise exception ''Ticket duration is below the minimum for this player count.'';
  end if;'
  );

  if v_function_definition = v_duration_rule_definition then
    raise exception 'Expected ticket duration validation block was not found.';
  end if;

  if v_function_definition = v_previous_definition then
    raise exception 'Expected ticket duration validation rules were not found.';
  end if;

  execute v_function_definition;
end;
$$;

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) from public, anon;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) to authenticated;
