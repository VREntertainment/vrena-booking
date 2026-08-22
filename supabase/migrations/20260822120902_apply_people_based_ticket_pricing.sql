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
      E'  if p_arena_count < 1 or p_arena_count > 2 then\n    raise exception ''Ticket bookings can reserve one or two arenas.'';\n  end if;',
      E'  if p_arena_count < 1 or p_arena_count > 2 then\n    raise exception ''Ticket bookings can reserve one or two arenas.'';\n  end if;\n\n  if p_arena_count = 2 and p_player_count <= 4 then\n    raise exception ''Two arenas require at least five players.'';\n  end if;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected arena validation was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'  v_charged_players_per_block integer;\n  v_charged_player_spots integer;',
      E'  v_charged_players_per_block numeric;\n  v_charged_player_spots numeric;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected integer pricing variables were not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'  v_charged_players_per_block := least(p_player_count, p_arena_count * 4);',
      E'  v_charged_players_per_block :=\n    least(p_player_count, p_arena_count * 4)\n    + greatest(p_player_count - (p_arena_count * 4), 0) * 0.5;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected arena-capacity pricing assignment was not found in %.', v_signature;
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

notify pgrst, 'reload schema';

commit;
