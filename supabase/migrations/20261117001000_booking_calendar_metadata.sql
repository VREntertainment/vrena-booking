begin;
-- Additive release: no historical rows are rewritten and no existing trigger or
-- booking function is disabled/replaced. Legacy choices are read from evidence.
alter table public.sessions
 add column booking_category text check (booking_category in ('standard','birthday','event')),
 add column booking_source text check (booking_source in ('walk_in','zalo','whatsapp','phone','website','social_media','other')),
 add column game_selection_explicit boolean;

create function private.booking_game_available_at_venue(p_slug text,p_venue text)
returns boolean language sql immutable set search_path='' as $$
 select p_venue='ha-do-centrosa' or (p_venue='cafe-des-stagiaires' and p_slug=any(array[
 'revolta','city-z','station-zarya','birthday-party','portal-zombie','arcade-2-0','party-games','portal-mafia','orc-kings-arena','vr-arena-strike']));
$$;
revoke all on function private.booking_game_available_at_venue(text,text) from public,anon,authenticated;

create function private.calendar_booking_metadata(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'booking_category',coalesce(s.booking_category,case when s.ticket_type='birthday' then 'birthday' when s.ticket_type='corporate' or s.notes like '%Event / corporate; reserved minutes:%' then 'event' else 'standard' end),
  'booking_source',s.booking_source,
  'game_selection_explicit',coalesce(s.game_selection_explicit,
    (s.confirmed_game_id='sim-racing' or s.ticket_reference like 'POS-%' or exists(
      select 1 from public.audit_logs a where a.entity_id=s.id and a.entity_type='sessions' and a.action='staff_calendar_booking_updated'
      and nullif(a.new_value->>'game_slug','') is not null and a.new_value->>'game_slug'=s.confirmed_game_id
    )) is true)
 ) from public.sessions s where s.id=p_id;
$$;
revoke all on function private.calendar_booking_metadata(uuid) from public,anon,authenticated;

create function private.set_booking_metadata()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.booking_category:=coalesce(new.booking_category,case when new.ticket_type='birthday' then 'birthday' when new.ticket_type='corporate' then 'event' else 'standard' end);
  if new.booking_type='ticket' and new.confirmed_game_id is distinct from 'sim-racing' then
   if new.ticket_reference like 'POS-%' and coalesce(public.current_staff_role_rank(),0)>=50 then
    new.game_selection_explicit:=new.confirmed_game_id is not null;
   else
    -- Current online tickets reserve time; the customer does not choose a game.
    new.game_options:=array[]::text[]; new.confirmed_game_id:=null; new.game_votes:='{}'::jsonb;
    new.game_selection_explicit:=false; new.booking_source:='website';
   end if;
  end if;
 elsif coalesce(auth.role(),'')<>'service_role' and coalesce(public.current_staff_role_rank(),0)<50
  and (new.booking_category is distinct from old.booking_category or new.booking_source is distinct from old.booking_source or new.game_selection_explicit is distinct from old.game_selection_explicit)
 then raise exception 'Booking metadata can only be changed by staff.';
 end if;
 return new;
end $$;
revoke all on function private.set_booking_metadata() from public,anon,authenticated;
create trigger sessions_booking_metadata before insert or update on public.sessions for each row execute function private.set_booking_metadata();

-- Validate parent-game venue availability for every existing games-played caller.
create function private.check_played_games_venue()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_venue text;
begin
 select venue_key into v_venue from public.sessions where id=new.session_id for update;
 if exists(select 1 from unnest(new.game_ids) i join public.staff_playable_games g on g.id=i
   where not private.booking_game_available_at_venue(g.parent_slug,v_venue))
 then raise exception 'This game is not available at the selected shop.'; end if;
 return new;
end $$;
revoke all on function private.check_played_games_venue() from public,anon,authenticated;
create trigger staff_games_played_venue before insert or update on public.staff_session_games_played for each row execute function private.check_played_games_venue();
CREATE OR REPLACE FUNCTION private.staff_update_booking_details(p_session_id uuid, p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid(); v_before public.sessions%rowtype; v_session public.sessions%rowtype; v_game public.staff_games%rowtype;
  v_venue text := p_booking->>'venue_key'; v_date date := (p_booking->>'date')::date; v_time time := (p_booking->>'start_time')::time;
  v_duration int := (p_booking->>'duration_minutes')::int; v_players int := (p_booking->>'players')::int; v_arenas int := (p_booking->>'arena_count')::int;
  v_status text := p_booking->>'status'; v_arena text := p_booking->>'arena_id'; v_start int; v_end int; v_used int; v_blocked int; v_key text;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(),0) < 50 then raise exception 'Staff access required.'; end if;
  if v_venue is null or v_venue not in ('ha-do-centrosa','cafe-des-stagiaires') then raise exception 'Invalid shop.'; end if;
  if v_date is null or v_time is null or v_duration is null or v_duration not between 20 and 240 or v_players is null or v_players not between 1 and 64
    or v_arenas is null or v_arenas not between 1 and (case when v_venue='cafe-des-stagiaires' then 1 else 2 end)
    or v_status is null or v_status not in ('open','completed','cancelled') or nullif(btrim(p_booking->>'name'),'') is null then raise exception 'Enter valid booking details.'; end if;
  if p_booking->>'booking_category' is not null and p_booking->>'booking_category' not in ('standard','birthday','event') then raise exception 'Invalid booking category.'; end if;
  if p_booking->>'booking_source' is not null and p_booking->>'booking_source' not in ('walk_in','zalo','whatsapp','phone','website','social_media','other') then raise exception 'Invalid booking source.'; end if;
  select s.* into v_before from public.sessions s where s.id=p_session_id and s.deleted_at is null and exists(select 1 from staff_location_scope.sessions allowed where allowed.id=s.id);
  if not found then raise exception 'Session not found.'; end if;
  -- Match creation's venue/date locks, before row locks, and take two-shop moves in stable order.
  for v_key in select distinct k from unnest(array[
    'staff_booking:'||coalesce(v_before.venue_key,'ha-do-centrosa')||':'||v_before.date::text,
    'staff_booking:'||v_venue||':'||v_date::text]) k order by k
  loop perform pg_advisory_xact_lock(hashtextextended(v_key,0)); end loop;
  select s.* into v_session from public.sessions s where s.id=p_session_id and s.deleted_at is null and exists(select 1 from staff_location_scope.sessions allowed where allowed.id=s.id) for update;
  if not found then raise exception 'Session not found.'; end if;
  if v_session.updated_at is distinct from v_before.updated_at or (p_booking->>'expected_updated_at' is not null and v_session.updated_at is distinct from (p_booking->>'expected_updated_at')::timestamptz) then
    raise exception 'This booking has changed. Close and reopen it before saving.';
  end if;
  if nullif(p_booking->>'game_slug','') is not null then
    select * into v_game from public.staff_games where slug=p_booking->>'game_slug' and active;
    if not found then raise exception 'Choose an active game.'; end if;
    if not private.booking_game_available_at_venue(v_game.slug,v_venue) then raise exception 'This game is not available at the selected shop.'; end if;
  end if;

  if v_venue='cafe-des-stagiaires' then v_arena := 'cafe:arena-1';
  elsif v_arena is null or not (v_arena=any(coalesce(nullif(v_game.available_arena_ids,array[]::text[]),array['arena-1','arena-2']))) then raise exception 'Choose an arena available for this game.'; end if;
  if v_players < (select count(*) from staff_location_scope.session_participants where session_id=p_session_id and deleted_at is null) then raise exception 'Player count cannot be lower than the joined players.'; end if;
  v_start := extract(hour from v_time)::int*60+extract(minute from v_time)::int; v_end := v_start+v_duration;
  if v_start < 0 or v_start >= 1440 or v_end > 1440 then raise exception 'Booking must end on the same day.'; end if;
  if not coalesce((p_booking->>'allow_outside_hours')::boolean,false) and ((v_venue = 'ha-do-centrosa' and v_time > time '21:30') or v_start < (case when v_venue='cafe-des-stagiaires' then 930 else 540 end) or v_end > (case when v_venue='cafe-des-stagiaires' then 1380 else 1320 end)) then raise exception 'Selected time is outside opening hours.'; end if;
  if v_status='open' then
    select coalesce(sum(coalesce(arena_count,1)),0) into v_used from staff_location_scope.sessions
    where id<>p_session_id and venue_key=v_venue and date=v_date and deleted_at is null and status='open'
      and coalesce(ticket_status,'') not in ('cancelled','expired')
      and (v_date+start_time::time) < (v_date+v_time)+make_interval(mins=>v_duration) and (v_date+v_time) < (v_date+start_time::time)+make_interval(mins=>duration_minutes);
    select coalesce(sum(arenas_used),0) into v_blocked from staff_location_scope.blocked_times
    where v_venue='ha-do-centrosa' and date=v_date and (v_date+start_time::time)<(v_date+v_time)+make_interval(mins=>v_duration) and (v_date+v_time)<(v_date+end_time::time);
    if v_used+v_blocked+v_arenas > (case when v_venue='cafe-des-stagiaires' then 1 else 2 end) then raise exception 'Selected time slot is no longer available.'; end if;
    if exists(select 1 from staff_location_scope.staff_orders o join staff_location_scope.sessions s on s.id=o.session_id
      where s.id<>p_session_id and o.arena_id=v_arena and s.venue_key=v_venue and s.date=v_date and s.deleted_at is null and s.status='open'
        and coalesce(s.ticket_status,'') not in ('cancelled','expired')
        and (v_date+s.start_time::time)<(v_date+v_time)+make_interval(mins=>v_duration) and (v_date+v_time)<(v_date+s.start_time::time)+make_interval(mins=>s.duration_minutes)) then
      raise exception 'This arena is already booked at the selected time. Choose another arena or time.';
    end if;
  end if;
  perform private.staff_apply_calendar_order_totals(p_session_id, p_booking->'order_adjustments');
  update public.sessions set name=btrim(p_booking->>'name'), venue_key=v_venue, date=v_date, start_time=v_time, duration_minutes=v_duration,
    max_players=v_players, arena_count=v_arenas,
    confirmed_game_id=case when coalesce((p_booking->>'game_changed')::boolean,true) then v_game.slug else confirmed_game_id end,
    game_options=case when coalesce((p_booking->>'game_changed')::boolean,true) then case when v_game.slug is null then array[]::text[] else array[v_game.slug] end else game_options end,
    game_selection_explicit=case when coalesce((p_booking->>'game_changed')::boolean,true) then v_game.slug is not null else game_selection_explicit end,
    booking_category=coalesce(p_booking->>'booking_category',booking_category), booking_source=p_booking->>'booking_source', status=v_status,
    ticket_player_count=case when booking_type='ticket' then v_players else ticket_player_count end,
    ticket_status=case when booking_type='ticket' then case when v_status='cancelled' then 'cancelled' else 'confirmed' end else ticket_status end,
    notes=nullif(p_booking->>'notes',''),updated_at=now() where id=p_session_id;
  -- Preserve payments; agreed totals change only through the explicit adjustment above.
  update public.staff_orders set booking_date=v_date,booking_time=v_time,players_count=v_players,arena_id=v_arena,game_id=case when coalesce((p_booking->>'game_changed')::boolean,true) then v_game.id else game_id end,
    booking_source=p_booking->>'booking_source',
    order_status=case when v_status='cancelled' and order_status<>'refunded' then 'cancelled' when v_status='completed' and order_status<>'refunded' then 'completed'
      when v_status='open' and order_status in ('cancelled','completed','no_show') then 'confirmed' else order_status end,
    updated_at=now() where session_id=p_session_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value)
    values(v_actor,'staff_calendar_booking_updated','sessions',p_session_id,to_jsonb(v_session),p_booking);
  return jsonb_build_object('session_id',p_session_id,'date',v_date,'venue_key',v_venue);
end $function$
;
revoke all on function private.staff_update_booking_details(uuid,jsonb) from public,anon,authenticated;
create function public.staff_update_booking_details(p_session_id uuid,p_booking jsonb)
returns jsonb language sql security definer set search_path='' as $$select private.staff_update_booking_details(p_session_id,p_booking);$$;
revoke all on function public.staff_update_booking_details(uuid,jsonb) from public,anon;
grant execute on function public.staff_update_booking_details(uuid,jsonb) to authenticated;

create function public.staff_get_booking_details(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if not exists(select 1 from staff_location_scope.sessions where id=p_session_id and deleted_at is null) then raise exception 'Booking not found.'; end if;
 return (select to_jsonb(s)||private.calendar_booking_metadata(s.id) from public.sessions s where s.id=p_session_id);
end $$;
revoke all on function public.staff_get_booking_details(uuid) from public,anon;
grant execute on function public.staff_get_booking_details(uuid) to authenticated;

create function public.staff_create_booking_with_metadata(p_booking jsonb,p_booking_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; category text:=coalesce(p_booking->>'p_booking_category',case when p_booking->>'p_booking_kind'='event' then 'event' else 'standard' end);
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if category not in ('standard','birthday','event') then raise exception 'Invalid booking category.'; end if;
 result:=public.staff_create_booking(p_booking,p_booking_source);
 update public.sessions set booking_category=category,booking_source=p_booking_source,
   game_selection_explicit=nullif(p_booking->>'p_game_id','') is not null
 where id=(result->>'session_id')::uuid and exists(select 1 from staff_location_scope.sessions allowed where allowed.id=public.sessions.id);
 return result;
end $$;
revoke all on function public.staff_create_booking_with_metadata(jsonb,text) from public,anon;
grant execute on function public.staff_create_booking_with_metadata(jsonb,text) to authenticated;

-- Enrich only rows already authorized by the existing list RPC. Booking sources
-- stay in the staff editor; the public calendar gets only category/choice flags.
create function public.booking_calendar_list_page(p_start_date date default null,p_end_date date default null,p_limit integer default 120,p_offset integer default 0,p_include_blocked_times boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; enriched jsonb;
begin
 result:=public.sessions_list_page(p_start_date,p_end_date,p_limit,p_offset,p_include_blocked_times);
 select coalesce(jsonb_agg(item.value||(private.calendar_booking_metadata((item.value->>'id')::uuid)-'booking_source') order by item.ordinality),'[]'::jsonb)
 into enriched from jsonb_array_elements(result->'sessions') with ordinality item;
 return jsonb_set(result,'{sessions}',enriched);
end $$;
revoke all on function public.booking_calendar_list_page(date,date,integer,integer,boolean) from public;
grant execute on function public.booking_calendar_list_page(date,date,integer,integer,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
