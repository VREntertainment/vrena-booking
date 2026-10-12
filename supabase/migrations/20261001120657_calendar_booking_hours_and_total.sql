begin;

-- Reuse the existing payment-ledger and stale-order protections in the same transaction.
create or replace function private.staff_apply_calendar_order_totals(p_session_id uuid, p_adjustments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_change jsonb; v_order public.staff_orders%rowtype;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0) < 50 then raise exception 'Staff access required.'; end if;
  if p_adjustments is null then return; end if;
  if jsonb_typeof(p_adjustments) <> 'array' then raise exception 'Invalid price adjustments.'; end if;
  for v_change in select value from jsonb_array_elements(p_adjustments) order by value->>'order_id' loop
    select * into v_order from public.staff_orders where id=(v_change->>'order_id')::uuid and session_id=p_session_id for update;
    if not found then raise exception 'Order does not belong to this booking.'; end if;
    if v_change->>'total' is null or v_change->>'total' !~ '^[0-9]+$' or (v_change->>'total')::numeric > 2147483647 then
      raise exception 'Enter a whole VND total of zero or more.';
    end if;
    if (v_change->>'total')::integer is distinct from v_order.total then
      perform private.staff_adjust_order_total(v_order.id, (v_change->>'total')::integer, v_change->>'reason', (v_change->>'expected_updated_at')::timestamptz);
    end if;
  end loop;
end $$;
revoke all on function private.staff_apply_calendar_order_totals(uuid,jsonb) from public, anon, authenticated;

create or replace function private.staff_update_calendar_booking(p_session_id uuid,p_booking jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  if p_booking->>'booking_source' is not null and p_booking->>'booking_source' not in ('walk_in','zalo','whatsapp','phone','website','other') then raise exception 'Invalid booking source.'; end if;
  select * into v_before from public.sessions where id=p_session_id and deleted_at is null;
  if not found then raise exception 'Session not found.'; end if;
  -- Match creation's venue/date locks, before row locks, and take two-shop moves in stable order.
  for v_key in select distinct k from unnest(array[
    'staff_booking:'||coalesce(v_before.venue_key,'ha-do-centrosa')||':'||v_before.date::text,
    'staff_booking:'||v_venue||':'||v_date::text]) k order by k
  loop perform pg_advisory_xact_lock(hashtextextended(v_key,0)); end loop;
  select * into v_session from public.sessions where id=p_session_id and deleted_at is null for update;
  if not found then raise exception 'Session not found.'; end if;
  if v_session.updated_at is distinct from v_before.updated_at or (p_booking->>'expected_updated_at' is not null and v_session.updated_at is distinct from (p_booking->>'expected_updated_at')::timestamptz) then
    raise exception 'This booking has changed. Close and reopen it before saving.';
  end if;
  select * into v_game from public.staff_games where slug=p_booking->>'game_slug' and active;
  if not found then raise exception 'Choose an active game.'; end if;
  if v_venue='cafe-des-stagiaires' and v_game.slug not in ('revolta','city-z','station-zarya') then raise exception 'This game is not available at the selected shop.'; end if;
  if v_venue='cafe-des-stagiaires' then v_arena := 'cafe:arena-1';
  elsif v_arena is null or not (v_arena=any(coalesce(nullif(v_game.available_arena_ids,array[]::text[]),array['arena-1','arena-2']))) then raise exception 'Choose an arena available for this game.'; end if;
  if v_players < (select count(*) from public.session_participants where session_id=p_session_id and deleted_at is null) then raise exception 'Player count cannot be lower than the joined players.'; end if;
  v_start := extract(hour from v_time)::int*60+extract(minute from v_time)::int; v_end := v_start+v_duration;
  if v_start < 0 or v_start >= 1440 or v_end > 1440 then raise exception 'Booking must end on the same day.'; end if;
  if not coalesce((p_booking->>'allow_outside_hours')::boolean,false) and (v_start < (case when v_venue='cafe-des-stagiaires' then 930 else 540 end) or v_end > (case when v_venue='cafe-des-stagiaires' then 1380 else 1320 end)) then raise exception 'Selected time is outside opening hours.'; end if;
  if v_status='open' then
    select coalesce(sum(coalesce(arena_count,1)),0) into v_used from public.sessions
    where id<>p_session_id and venue_key=v_venue and date=v_date and deleted_at is null and status='open'
      and coalesce(ticket_status,'') not in ('cancelled','expired')
      and (v_date+start_time::time) < (v_date+v_time)+make_interval(mins=>v_duration) and (v_date+v_time) < (v_date+start_time::time)+make_interval(mins=>duration_minutes);
    select coalesce(sum(arenas_used),0) into v_blocked from public.blocked_times
    where v_venue='ha-do-centrosa' and date=v_date and (v_date+start_time::time)<(v_date+v_time)+make_interval(mins=>v_duration) and (v_date+v_time)<(v_date+end_time::time);
    if v_used+v_blocked+v_arenas > (case when v_venue='cafe-des-stagiaires' then 1 else 2 end) then raise exception 'Selected time slot is no longer available.'; end if;
    if exists(select 1 from public.staff_orders o join public.sessions s on s.id=o.session_id
      where s.id<>p_session_id and o.arena_id=v_arena and s.venue_key=v_venue and s.date=v_date and s.deleted_at is null and s.status='open'
        and coalesce(s.ticket_status,'') not in ('cancelled','expired')
        and (v_date+s.start_time::time)<(v_date+v_time)+make_interval(mins=>v_duration) and (v_date+v_time)<(v_date+s.start_time::time)+make_interval(mins=>s.duration_minutes)) then
      raise exception 'This arena is already booked at the selected time. Choose another arena or time.';
    end if;
  end if;
  perform private.staff_apply_calendar_order_totals(p_session_id, p_booking->'order_adjustments');
  update public.sessions set name=btrim(p_booking->>'name'), venue_key=v_venue, date=v_date, start_time=v_time, duration_minutes=v_duration,
    max_players=v_players, arena_count=v_arenas, confirmed_game_id=v_game.slug, game_options=array[v_game.slug], status=v_status,
    ticket_player_count=case when booking_type='ticket' then v_players else ticket_player_count end,
    ticket_status=case when booking_type='ticket' then case when v_status='cancelled' then 'cancelled' else 'confirmed' end else ticket_status end,
    notes=nullif(p_booking->>'notes',''),updated_at=now() where id=p_session_id;
  -- Preserve payments; agreed totals change only through the explicit adjustment above.
  update public.staff_orders set booking_date=v_date,booking_time=v_time,players_count=v_players,arena_id=v_arena,game_id=v_game.id,
    booking_source=p_booking->>'booking_source',
    order_status=case when v_status='cancelled' and order_status<>'refunded' then 'cancelled' when v_status='completed' and order_status<>'refunded' then 'completed'
      when v_status='open' and order_status in ('cancelled','completed','no_show') then 'confirmed' else order_status end,
    updated_at=now() where session_id=p_session_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value)
    values(v_actor,'staff_calendar_booking_updated','sessions',p_session_id,to_jsonb(v_session),p_booking);
  return jsonb_build_object('session_id',p_session_id,'date',v_date,'venue_key',v_venue);
end $$;

create or replace function private.staff_update_sim_racing_booking(p_session_id uuid,p_booking jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.sessions%rowtype; v_date date := (p_booking->>'date')::date; v_time time := (p_booking->>'start_time')::time; v_status text := p_booking->>'status';
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0) < 50 then raise exception 'Staff access required.'; end if;
  select * into v_session from public.sessions where id=p_session_id and confirmed_game_id='sim-racing' and deleted_at is null for update;
  if not found then raise exception 'SIM Racing booking not found.'; end if;
  if v_session.updated_at is distinct from (p_booking->>'expected_updated_at')::timestamptz then raise exception 'This booking has changed. Close and reopen it.'; end if;
  if v_date is null or v_time is null or v_status is null or v_status not in ('open','cancelled','completed') then raise exception 'Invalid booking details.'; end if;
  if extract(epoch from v_time)/60 + v_session.duration_minutes > 1440 or v_time >= time '24:00' then raise exception 'Booking must end on the same day.'; end if;
  if not coalesce((p_booking->>'allow_outside_hours')::boolean,false) and (v_time < time '09:00' or extract(epoch from v_time)/60 + v_session.duration_minutes > 1320) then raise exception 'Selected time is outside opening hours.'; end if;
  perform private.staff_apply_calendar_order_totals(p_session_id, p_booking->'order_adjustments');
  update public.sessions set date=v_date,start_time=v_time,status=v_status,ticket_status=case when v_status='open' then 'confirmed' else v_status end,
    notes=left(p_booking->>'notes',500) where id=p_session_id;
  update public.staff_orders set booking_date=v_date,booking_time=v_time,order_status=case when v_status='open' then case when payment_status='paid' then 'paid' else 'confirmed' end else v_status end
    where session_id=p_session_id;
  return jsonb_build_object('session_id',p_session_id);
exception when exclusion_violation then raise exception 'The simulator is already booked at this time.';
end $$;

notify pgrst, 'reload schema';
commit;
