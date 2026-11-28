-- Apply games played in the same transaction as changes to the calendar booking.
do $migration$
declare
  signature regprocedure;
  definition text;
  marker constant text := ' return result;';
begin
  foreach signature in array array[
    'public.staff_update_booking_details(uuid,jsonb)'::regprocedure,
    'public.staff_update_sim_racing_booking(uuid,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(signature);
    if strpos(definition, marker) = 0 then
      raise exception 'Expected calendar booking return statement is missing.';
    end if;
    execute replace(definition, marker, $patch$
 if p_booking ? 'games_played' then
   if jsonb_typeof(p_booking->'games_played'->'game_ids') is distinct from 'array' then
     raise exception 'Choose valid games.';
   end if;
   perform private.staff_confirm_games_played(
     p_session_id,
     array(select jsonb_array_elements_text(p_booking->'games_played'->'game_ids')),
     (p_booking->'games_played'->>'expected_updated_at')::timestamptz
   );
 end if;
 return result;$patch$);
  end loop;
end
$migration$;
