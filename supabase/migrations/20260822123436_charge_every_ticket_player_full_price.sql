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
      E'  v_charged_players_per_block :=\n    least(p_player_count, p_arena_count * 4)\n    + greatest(p_player_count - (p_arena_count * 4), 0) * 0.5;',
      E'  v_charged_players_per_block := p_player_count;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected rotation-player pricing assignment was not found in %.', v_signature;
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
