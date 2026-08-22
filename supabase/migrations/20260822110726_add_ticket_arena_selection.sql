begin;

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure,
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_function_definition;
    v_original_definition := v_function_definition;

    v_function_definition := replace(
      v_function_definition,
      E'  if p_arena_count <> 1 then\n    raise exception ''Ticket bookings reserve exactly one arena.'';\n  end if;',
      E'  if p_arena_count < 1 or p_arena_count > 2 then\n    raise exception ''Ticket bookings can reserve one or two arenas.'';\n  end if;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected one-arena validation was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % 20 <> 0 then\n    raise exception ''Invalid booking duration.'';\n  end if;',
      E'  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % 20 <> 0 then\n    raise exception ''Invalid booking duration.'';\n  end if;\n\n  if p_duration_minutes < ceil(p_player_count::numeric / (p_arena_count * 4))::integer * 20 then\n    raise exception ''Ticket duration is below the minimum for the selected players and arenas.'';\n  end if;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected duration validation was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'  v_charged_players_per_block := case\n    when p_player_count <= 4 then p_player_count\n    else 4\n  end;',
      E'  v_charged_players_per_block := least(p_player_count, p_arena_count * 4);'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected capacity pricing block was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'  if v_remaining_arenas < 1 then\n    raise exception ''Selected time slot is no longer available.'';\n  end if;',
      E'  if v_remaining_arenas < p_arena_count then\n    raise exception ''Selected time slot does not have enough arenas available.'';\n  end if;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected one-arena availability validation was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'    p_player_count,\n    1,\n    array[]::text[],',
      E'    p_player_count,\n    p_arena_count,\n    array[]::text[],'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected fixed session arena count was not found in %.', v_signature;
    end if;

    execute v_function_definition;
  end loop;
end;
$migration$;

revoke all on function public.create_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, integer, text, text
) from public, anon;
grant execute on function public.create_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, integer, text, text
) to authenticated;

revoke all on function public.create_guest_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, text, text, text
) from public;
grant execute on function public.create_guest_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, text, text, text
) to anon, authenticated;

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
begin
  select pg_get_functiondef('public.protect_session_participant_trusted_fields()'::regprocedure)
  into v_function_definition;
  v_original_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    E'      and new.profile_id = v_actor\n      and new.profile_id = v_session.ticket_customer_id',
    E'      and new.profile_id = v_session.ticket_customer_id\n      and (\n        new.profile_id = v_actor\n        or (\n          v_actor is null\n          and v_session.owner_id = v_session.ticket_customer_id\n        )\n      )'
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected authenticated-only ticket quote allowance was not found.';
  end if;

  execute v_function_definition;
end;
$migration$;

revoke all on function public.protect_session_participant_trusted_fields() from public, anon, authenticated;
grant execute on function public.protect_session_participant_trusted_fields() to service_role;

notify pgrst, 'reload schema';

commit;
