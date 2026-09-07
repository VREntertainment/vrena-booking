begin;

-- Historical sources remain unknown; do not infer walk-ins for existing orders.
alter table public.staff_orders add column if not exists booking_source text
  check (booking_source in ('walk_in','zalo','whatsapp','phone','website','other'));

create or replace function private.staff_create_booking(p_booking jsonb, p_booking_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.current_staff_role_rank() < 50 then raise exception 'Staff access required.'; end if;
  if p_booking_source is null or p_booking_source not in ('walk_in','zalo','whatsapp','phone','website','other') then raise exception 'Invalid booking source.'; end if;
  v_result := public.create_staff_order_with_payments(
    p_customer_id => (p_booking->>'p_customer_id')::uuid,
    p_customer_name => p_booking->>'p_customer_name', p_customer_phone => p_booking->>'p_customer_phone', p_customer_email => p_booking->>'p_customer_email',
    p_game_id => (p_booking->>'p_game_id')::uuid, p_booking_date => (p_booking->>'p_booking_date')::date,
    p_booking_time => (p_booking->>'p_booking_time')::time, p_players_count => (p_booking->>'p_players_count')::int,
    p_arena_id => p_booking->>'p_arena_id', p_discount_rule_id => (p_booking->>'p_discount_rule_id')::uuid,
    p_order_status => p_booking->>'p_order_status', p_invoice_required => coalesce((p_booking->>'p_invoice_required')::boolean,false),
    p_company_name => p_booking->>'p_company_name', p_tax_code => p_booking->>'p_tax_code', p_invoice_email => p_booking->>'p_invoice_email',
    p_invoice_address => p_booking->>'p_invoice_address', p_internal_note => p_booking->>'p_internal_note',
    p_manual_discount_type => p_booking->>'p_manual_discount_type', p_manual_discount_value => coalesce((p_booking->>'p_manual_discount_value')::numeric,0),
    p_payment_splits => coalesce(p_booking->'p_payment_splits','[]'::jsonb)
  );
  update public.staff_orders set booking_source=p_booking_source where id=(v_result->>'order_id')::uuid;
  return v_result || jsonb_build_object('booking_source',p_booking_source);
end $$;
revoke all on function private.staff_create_booking(jsonb,text) from public,anon;
grant execute on function private.staff_create_booking(jsonb,text) to authenticated;
create or replace function public.staff_create_booking(p_booking jsonb,p_booking_source text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.staff_create_booking(p_booking,p_booking_source); $$;
revoke all on function public.staff_create_booking(jsonb,text) from public,anon;
grant execute on function public.staff_create_booking(jsonb,text) to authenticated;

create or replace function private.staff_update_calendar_booking(p_session_id uuid,p_booking jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_before public.sessions%rowtype; v_session public.sessions%rowtype; v_game public.staff_games%rowtype;
  v_venue text := p_booking->>'venue_key'; v_date date := (p_booking->>'date')::date; v_time time := (p_booking->>'start_time')::time;
  v_duration int := (p_booking->>'duration_minutes')::int; v_players int := (p_booking->>'players')::int; v_arenas int := (p_booking->>'arena_count')::int;
  v_status text := p_booking->>'status'; v_arena text := p_booking->>'arena_id'; v_start int; v_end int; v_used int; v_blocked int; v_key text;
begin
  if v_actor is null or public.current_staff_role_rank() < 50 then raise exception 'Staff access required.'; end if;
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
  if v_start < (case when v_venue='cafe-des-stagiaires' then 960 else 540 end) or v_end>1320 then raise exception 'Selected time is outside opening hours.'; end if;
  if v_status='open' then
    select coalesce(sum(coalesce(arena_count,1)),0) into v_used from public.sessions
    where id<>p_session_id and venue_key=v_venue and date=v_date and deleted_at is null and status='open'
      and coalesce(ticket_status,'') not in ('cancelled','expired')
      and start_time::time < v_time+make_interval(mins=>v_duration) and v_time < start_time::time+make_interval(mins=>duration_minutes);
    select coalesce(sum(arenas_used),0) into v_blocked from public.blocked_times
    where v_venue='ha-do-centrosa' and date=v_date and start_time::time<v_time+make_interval(mins=>v_duration) and v_time<end_time::time;
    if v_used+v_blocked+v_arenas > (case when v_venue='cafe-des-stagiaires' then 1 else 2 end) then raise exception 'Selected time slot is no longer available.'; end if;
    if exists(select 1 from public.staff_orders o join public.sessions s on s.id=o.session_id
      where s.id<>p_session_id and o.arena_id=v_arena and s.venue_key=v_venue and s.date=v_date and s.deleted_at is null and s.status='open'
        and coalesce(s.ticket_status,'') not in ('cancelled','expired')
        and s.start_time::time<v_time+make_interval(mins=>v_duration) and v_time<s.start_time::time+make_interval(mins=>s.duration_minutes)) then
      raise exception 'This arena is already booked at the selected time. Choose another arena or time.';
    end if;
  end if;
  update public.sessions set name=btrim(p_booking->>'name'), venue_key=v_venue, date=v_date, start_time=v_time, duration_minutes=v_duration,
    max_players=v_players, arena_count=v_arenas, confirmed_game_id=v_game.slug, game_options=array[v_game.slug], status=v_status,
    ticket_player_count=case when booking_type='ticket' then v_players else ticket_player_count end,
    ticket_status=case when booking_type='ticket' then case when v_status='cancelled' then 'cancelled' else 'confirmed' end else ticket_status end,
    notes=nullif(p_booking->>'notes',''),updated_at=now() where id=p_session_id;
  -- Keep the agreed financial terms and actual payment ledger intact when rescheduling.
  update public.staff_orders set booking_date=v_date,booking_time=v_time,players_count=v_players,arena_id=v_arena,game_id=v_game.id,
    booking_source=p_booking->>'booking_source',
    order_status=case when v_status='cancelled' and order_status<>'refunded' then 'cancelled' when v_status='completed' and order_status<>'refunded' then 'completed'
      when v_status='open' and order_status in ('cancelled','completed','no_show') then 'confirmed' else order_status end,
    updated_at=now() where session_id=p_session_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value)
    values(v_actor,'staff_calendar_booking_updated','sessions',p_session_id,to_jsonb(v_session),p_booking);
  return jsonb_build_object('session_id',p_session_id,'date',v_date,'venue_key',v_venue);
end $$;
revoke all on function private.staff_update_calendar_booking(uuid,jsonb) from public,anon;
grant execute on function private.staff_update_calendar_booking(uuid,jsonb) to authenticated;
create or replace function public.staff_update_calendar_booking(p_session_id uuid,p_booking jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.staff_update_calendar_booking(p_session_id,p_booking); $$;
revoke all on function public.staff_update_calendar_booking(uuid,jsonb) from public,anon;
grant execute on function public.staff_update_calendar_booking(uuid,jsonb) to authenticated;
grant usage on schema private to authenticated;
notify pgrst,'reload schema';
commit;
