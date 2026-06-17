-- For 13-16 player ticket bookings, reserve one arena for 60 minutes minimum.
-- Longer selected durations are allowed and charged by reserved arena capacity.

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
    '  v_required_slots := ceil(p_player_count::numeric / 4)::integer;
  v_expected_duration := v_required_slots * 20;
  v_charged_player_spots := v_required_slots * 4;

  if p_duration_minutes <> v_expected_duration then
    raise exception ''Ticket duration does not match one-arena capacity for this player count.'';
  end if;',
    '  v_required_slots := case
    when p_player_count > 12 then 3
    else ceil(p_player_count::numeric / 4)::integer
  end;
  v_expected_duration := v_required_slots * 20;
  v_charged_player_spots := greatest(v_required_slots, ceil(p_duration_minutes::numeric / 20)::integer) * 4;

  if p_player_count > 12 then
    if p_duration_minutes < v_expected_duration then
      raise exception ''Ticket duration must be at least 60 minutes for 13-16 players.'';
    end if;
  elsif p_duration_minutes <> v_expected_duration then
    raise exception ''Ticket duration does not match one-arena capacity for this player count.'';
  end if;'
  );

  if v_function_definition = v_previous_definition then
    raise exception 'Expected ticket duration validation block was not found.';
  end if;

  if position('v_discount_rate := v_discount_rate + 0.10;' in v_function_definition) > 0 then
    v_function_definition := replace(
      v_function_definition,
      'v_discount_rate := v_discount_rate + 0.10;',
      'v_discount_rate := greatest(v_discount_rate, 0.10);'
    );
  end if;

  execute v_function_definition;
end;
$$;

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) from public, anon;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) to authenticated;
