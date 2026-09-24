begin;

-- Retain the hardened staff-only path and its old signatures for existing clients.
-- The new implementation supports a genuinely empty game and reserves the requested capacity.
do $migration$
declare definition text; signature text; routine record;
begin
  for routine in select p.oid, p.proname from pg_proc p
    where p.pronamespace='private'::regnamespace
      and p.proname in ('create_staff_reserved_order','create_staff_reserved_order_with_payments')
  loop
    definition := pg_get_functiondef(routine.oid);
    signature := split_part(definition,E'\n',1);
    definition := replace(definition,signature,'CREATE OR REPLACE FUNCTION private.'||routine.proname||'_v2('||pg_get_function_arguments(routine.oid)||', p_arena_count integer DEFAULT 1)');
    if routine.proname='create_staff_reserved_order' then
      definition := replace(definition,'if p_game_id is null or p_booking_date is null or p_booking_time is null then','if p_booking_date is null or p_booking_time is null then');
      definition := replace(definition,'Game, date, and time are required.','Date and time are required.');
      definition := replace(definition,$old$  if not found then
    raise exception 'Active game not found.';
  end if;$old$,$new$  if p_game_id is null then
    v_game.name := 'None';
    v_game.duration_minutes := 20;
    v_game.available_arena_ids := array['arena-1','arena-2'];
  elsif not found then
    raise exception 'Active game not found.';
  end if;
  if p_arena_id is null or p_arena_id not in ('arena-1','arena-2','cafe:arena-1') or p_arena_count is null
    or p_arena_count < 1 or p_arena_count > (case when v_venue_key='cafe-des-stagiaires' then 1 else 2 end) then
    raise exception 'Invalid arena selection.';
  end if;$new$);
      definition := replace(definition,'if v_game.slug not in (','if p_game_id is not null and v_game.slug not in (');
      definition := replace(definition,'if v_remaining_arenas < 1 then','if v_remaining_arenas < p_arena_count then');
      definition := replace(definition,'v_subtotal := v_duration_blocks * v_rule.price_per_arena_slot;','v_subtotal := p_arena_count * v_duration_blocks * v_rule.price_per_arena_slot;');
      definition := replace(definition, E'    p_players_count,\n    1,\n    array[v_game_slug],\n    jsonb_build_object(v_staff_id::text, v_game_slug),\n    v_game_slug,',
        E'    p_players_count,\n    p_arena_count,\n    case when p_game_id is null then array[]::text[] else array[v_game_slug] end,\n    case when p_game_id is null then ''{}''::jsonb else jsonb_build_object(v_staff_id::text, v_game_slug) end,\n    case when p_game_id is null then null else v_game_slug end,');
      if strpos(definition,E'    p_arena_count,\n    case when p_game_id is null')=0 then raise exception 'Session capacity insert changed.'; end if;
    else
      definition := replace(definition,'private.create_staff_reserved_order(','private.create_staff_reserved_order_v2(');
      definition := replace(definition,'p_manual_discount_value, p_reserved_minutes, p_outside_hours','p_manual_discount_value, p_reserved_minutes, p_outside_hours, p_arena_count');
    end if;
    execute definition;
    execute format('revoke all on function private.%I(%s,integer) from public,anon,authenticated',routine.proname||'_v2',pg_get_function_identity_arguments(routine.oid));
  end loop;
  definition := pg_get_functiondef('private.staff_create_booking(jsonb,text)'::regprocedure);
  definition := replace(definition,'private.create_staff_reserved_order_with_payments(','private.create_staff_reserved_order_with_payments_v2(');
  definition := replace(definition,$old$p_outside_hours => coalesce((p_booking->>'p_allow_outside_hours')::boolean,false)$old$,
    $new$p_outside_hours => coalesce((p_booking->>'p_allow_outside_hours')::boolean,false),
    p_arena_count => coalesce((p_booking->>'p_arena_count')::integer,1)$new$);
  execute definition;
end $migration$;

create or replace function private.staff_booking_availability_for_arenas(p_date date,p_time time,p_arena_id text,p_duration integer,p_arena_count integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  venue text := case when p_arena_id='cafe:arena-1' then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;
  start_min integer := extract(hour from p_time)::int*60+extract(minute from p_time)::int;
  end_min integer := start_min+p_duration;
  used integer; blocked integer;
  capacity integer := case when venue='cafe-des-stagiaires' then 1 else 2 end;
begin
  if auth.uid() is null or not public.is_staff_console_user(50) then raise exception 'Staff access required.'; end if;
  if p_date is null or p_time is null or p_duration is null or p_duration < 1 or end_min>1440
    or p_arena_id is null or p_arena_id not in ('arena-1','arena-2','cafe:arena-1')
    or p_arena_count is null or p_arena_count<1 or p_arena_count>capacity then return false; end if;
  select coalesce(sum(coalesce(s.arena_count,case when s.max_players>7 then 2 else 1 end)),0) into used
  from public.sessions s where s.venue_key=venue and s.date=p_date and s.deleted_at is null and s.status='open'
    and coalesce(s.ticket_status,'') not in ('cancelled','expired')
    and extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int < end_min
    and start_min < extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int+s.duration_minutes;
  select coalesce(sum(b.arenas_used),0) into blocked from public.blocked_times b
  where venue='ha-do-centrosa' and b.date=p_date
    and extract(hour from b.start_time::time)::int*60+extract(minute from b.start_time::time)::int < end_min
    and start_min < extract(hour from b.end_time::time)::int*60+extract(minute from b.end_time::time)::int;
  if used+blocked+p_arena_count > capacity then return false; end if;
  return not exists(select 1 from public.staff_orders o join public.sessions s on s.id=o.session_id
    where o.arena_id=p_arena_id and s.venue_key=venue and s.date=p_date and s.deleted_at is null and s.status='open'
      and coalesce(s.ticket_status,'') not in ('cancelled','expired')
      and extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int < end_min
      and start_min < extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int+s.duration_minutes);
end $$;
revoke all on function private.staff_booking_availability_for_arenas(date,time,text,integer,integer) from public,anon;
grant execute on function private.staff_booking_availability_for_arenas(date,time,text,integer,integer) to authenticated;
create or replace function public.staff_booking_availability_for_arenas(p_date date,p_time time,p_arena_id text,p_duration integer,p_arena_count integer)
returns boolean language sql security invoker set search_path = '' as $$ select private.staff_booking_availability_for_arenas(p_date,p_time,p_arena_id,p_duration,p_arena_count); $$;
revoke all on function public.staff_booking_availability_for_arenas(date,time,text,integer,integer) from public,anon;
grant execute on function public.staff_booking_availability_for_arenas(date,time,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
