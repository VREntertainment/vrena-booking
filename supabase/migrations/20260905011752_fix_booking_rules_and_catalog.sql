begin;

-- Internal rules shared by all three ticket endpoints. Browser-side capacity
-- helpers are checked against these rules in the booking regression suite.
create or replace function public.ticket_minimum_duration_minutes(
  p_venue_key text, p_date date, p_player_count integer, p_arena_count integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select ceil(p_player_count::numeric / (
    p_arena_count * case when p_venue_key = 'cafe-des-stagiaires' then 8 else 4 end
  ))::integer * public.ticket_tariff_price_block_minutes(p_date);
$$;

create or replace function public.ticket_booking_start_is_past(
  p_date date, p_start_time time without time zone, p_now timestamptz default now()
)
returns boolean
language sql
stable
strict
set search_path = ''
as $$
  select ((p_date + p_start_time) at time zone 'Asia/Ho_Chi_Minh') <= p_now;
$$;

revoke all on function public.ticket_minimum_duration_minutes(text,date,integer,integer) from public, anon, authenticated;
revoke all on function public.ticket_booking_start_is_past(date,time without time zone,timestamptz) from public, anon, authenticated;

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_before text;
  v_venue text;
begin
  foreach v_signature in array array[
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure,
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure,
    'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_venue := case when v_signature::text like '%create_cafe_ticket_booking_request%'
      then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;

    v_before := v_definition;
    v_definition := replace(v_definition,
      'ceil(p_player_count::numeric / (p_arena_count * 4))::integer * public.ticket_tariff_price_block_minutes(p_date)',
      format('public.ticket_minimum_duration_minutes(%L, p_date, p_player_count, p_arena_count)', v_venue));
    if v_definition = v_before then
      raise exception 'Expected minimum-duration validation missing in %', v_signature;
    end if;

    v_before := v_definition;
    v_definition := replace(v_definition,
      case when v_venue = 'cafe-des-stagiaires'
        then '(p_date + p_start_time) <= timezone(''Asia/Ho_Chi_Minh'', now())'
        else '(p_date + p_start_time) <= now()' end,
      'public.ticket_booking_start_is_past(p_date, p_start_time)');
    if v_definition = v_before then
      raise exception 'Expected past-time validation missing in %', v_signature;
    end if;

    if v_venue = 'cafe-des-stagiaires' then
      v_before := v_definition;
      v_definition := replace(v_definition,
        E'if p_arena_count < 1 or p_arena_count > 2 then\n    raise exception ''Ticket requests can include one or two arenas.'';',
        E'if p_arena_count is distinct from 1 then\n    raise exception ''Cafe bookings use one arena.'';');
      if v_definition = v_before then
        raise exception 'Expected Cafe arena validation missing';
      end if;
    end if;

    -- CREATE OR REPLACE preserves the existing endpoint grants and guards.
    execute v_definition;
  end loop;
end;
$migration$;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- The staff catalog is authoritative for game availability. Seed the already
-- advertised ANVIO titles without overwriting subsequent staff edits.
insert into public.staff_games (
  slug, name, game_type, duration_minutes, max_players_per_arena,
  number_of_rounds, image_url, available_arena_ids, audience, active
) values
  ('revolta', 'Revolta', 'shooting', 45, 8, 1, '/games/revolta.webp',
    array['arena-1', 'arena-2'], array['competitive', 'teamwork', 'fun'], true),
  ('city-z', 'City Z', 'other', 45, 6, 1, '/games/city-z.webp',
    array['arena-1', 'arena-2'], array['scary', 'quest', 'teamwork'], true),
  ('station-zarya', 'Station Zarya', 'other', 45, 6, 1, '/games/station-zarya.webp',
    array['arena-1', 'arena-2'], array['scary', 'quest', 'teamwork'], true)
on conflict (slug) do nothing;

commit;
