begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

-- The simulator is independent of both VR arenas. Zero VR arenas is valid only
-- for this fixed, single-driver product; existing VR capacity sums remain valid.
alter table public.sessions drop constraint sessions_arena_count_check;
alter table public.sessions add constraint sessions_arena_count_check check (
  (arena_count in (1,2) and confirmed_game_id is distinct from 'sim-racing') or
  (arena_count = 0 and coalesce(confirmed_game_id = 'sim-racing' and venue_key = 'ha-do-centrosa'
   and booking_type = 'ticket' and ticket_type = 'individual' and max_players = 1
   and ticket_player_count = 1 and duration_minutes = 15, false))
);
alter table public.sessions add column sim_racing_slot tsrange;
alter table public.sessions add constraint single_sim_racing_reservation
  exclude using gist (sim_racing_slot with &&)
  where (sim_racing_slot is not null and status = 'open' and deleted_at is null);

create function private.set_sim_racing_slot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and (old.confirmed_game_id = 'sim-racing') is distinct from (new.confirmed_game_id = 'sim-racing')
    and (old.confirmed_game_id = 'sim-racing' or new.confirmed_game_id = 'sim-racing') then
    raise exception 'SIM Racing bookings cannot be changed into VR arena bookings or vice versa.';
  end if;
  if new.confirmed_game_id = 'sim-racing' then
    if new.start_time::time < time '09:00' or new.start_time::time > time '21:45'
      or extract(minute from new.start_time::time)::int % 15 <> 0 or extract(second from new.start_time::time) <> 0 then
      raise exception 'Choose a 15-minute SIM Racing slot between 09:00 and 21:45.';
    end if;
    new.sim_racing_slot := tsrange(new.date + new.start_time::time, new.date + new.start_time::time + interval '15 minutes', '[)');
  else
    new.sim_racing_slot := null;
  end if;
  return new;
end $$;
revoke all on function private.set_sim_racing_slot() from public,anon,authenticated;
create trigger sessions_sim_racing_slot before insert or update on public.sessions
  for each row execute function private.set_sim_racing_slot();

-- Dedicated booking UI supplies this product. Keep it out of the generic VR
-- staff booking picker, which assumes VR arenas and duration-based tariffs.
insert into public.staff_games(slug,name,game_type,duration_minutes,max_players_per_arena,number_of_rounds,description,active,available_arena_ids)
values ('sim-racing','SIM Racing','other',15,1,3,'Ha Do only. 3 races, 15 minutes, 150,000 VND. One simulator.',false,array['sim-racing-1']);

create function private.sim_racing_available_times(p_date date)
returns table(start_time text) language sql stable security definer set search_path = '' as $$
  select to_char(slot, 'HH24:MI') from generate_series(p_date + time '09:00', p_date + time '21:45', interval '15 minutes') slot
  where p_date between (now() at time zone 'Asia/Ho_Chi_Minh')::date and (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90
    and slot > now() at time zone 'Asia/Ho_Chi_Minh'
    and not exists (select 1 from public.sessions s where s.sim_racing_slot && tsrange(slot,slot + interval '15 minutes','[)') and s.status='open' and s.deleted_at is null)
  order by slot;
$$;
revoke all on function private.sim_racing_available_times(date) from public;
revoke all on function private.sim_racing_available_times(date) from anon,authenticated;
create function public.sim_racing_available_times(p_date date) returns table(start_time text)
language sql stable security definer set search_path = '' as $$ select * from private.sim_racing_available_times(p_date); $$;
revoke all on function public.sim_racing_available_times(date) from public;
grant execute on function public.sim_racing_available_times(date) to anon,authenticated;

create function private.create_sim_racing_booking(p_date date,p_start_time time,p_guest_phone text default null,p_guest_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.profiles%rowtype;
  v_phone text := regexp_replace(coalesce(p_guest_phone,''),'[^0-9+]','','g');
  v_reference text := 'TKT-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_session uuid; v_game uuid; v_order uuid;
begin
  if p_date is null or p_start_time is null or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90
    or public.ticket_booking_start_is_past(p_date,p_start_time) then raise exception 'Choose a future booking within 90 days.'; end if;
  if p_start_time < time '09:00' or p_start_time > time '21:45' or extract(minute from p_start_time)::int % 15 <> 0
    or extract(second from p_start_time) <> 0 then raise exception 'Choose a 15-minute SIM Racing slot between 09:00 and 21:45.'; end if;
  if auth.uid() is not null then
    select * into v_customer from public.profiles where id=auth.uid();
    if v_customer.id is null then raise exception 'Complete your profile before booking.'; end if;
    if v_customer.birthday > (now() at time zone 'Asia/Ho_Chi_Minh')::date - interval '13 years' then raise exception 'A parent or guardian must make this booking.'; end if;
    v_phone := v_customer.phone;
  else
    v_phone := regexp_replace(v_phone,'(?!^)\+','','g');
    if length(regexp_replace(v_phone,'\D','','g')) not between 8 and 15 then raise exception 'Enter a valid phone number.'; end if;
    perform public.consume_guest_ticket_booking_rate_limit(v_phone,p_date,p_start_time,'sim-racing');
    select * into v_customer from public.ensure_guest_ticket_profile(v_phone,left(nullif(btrim(p_guest_name),''),120));
  end if;
  perform private.guard_duplicate_ticket_booking('ha-do-centrosa',v_customer.id,v_phone,'individual',p_date,p_start_time,15,1,0);
  select id into strict v_game from public.staff_games where slug='sim-racing';
  insert into public.sessions(owner_id,session_type,name,date,start_time,duration_minutes,max_players,arena_count,game_options,game_votes,
    confirmed_game_id,visibility,invite_code,notes,status,booking_type,ticket_type,ticket_player_count,ticket_unit_price,ticket_total_price,ticket_status,ticket_reference,ticket_customer_id,venue_key)
  values (v_customer.id,'game','SIM Racing — 3 races',p_date,p_start_time,15,1,0,array['sim-racing'],'{}','sim-racing','private',
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'3 races · 15 minutes · 1 simulator','open','ticket','individual',1,150000,150000,'confirmed',v_reference,v_customer.id,'ha-do-centrosa') returning id into v_session;
  insert into public.session_participants(session_id,profile_id,display_name,payment_amount)
    values(v_session,v_customer.id,coalesce(v_customer.nickname,v_customer.full_name,'Guest'),150000);
  insert into public.staff_orders(customer_id,customer_name,customer_phone,customer_email,game_id,session_id,booking_date,booking_time,players_count,arena_id,
    subtotal,discount_total,total,payment_method,payment_status,order_status,invoice_required,invoice_status,internal_note,booking_source,session_count)
  values(v_customer.id,coalesce(v_customer.full_name,v_customer.nickname),v_phone,v_customer.email,v_game,v_session,p_date,p_start_time,1,'sim-racing-1',
    150000,0,150000,'unpaid','unpaid','confirmed',false,'not_requested','SIM Racing: 3 races / 15 minutes. Reference: ' || v_reference,'website',1) returning id into v_order;
  return jsonb_build_object('session_id',v_session,'ticket_reference',v_reference,'ticket_total_price',150000,'ticket_status','confirmed','order_id',v_order);
exception when exclusion_violation then raise exception 'This simulator slot was just booked. Please choose another time.';
end $$;
revoke all on function private.create_sim_racing_booking(date,time,text,text) from public;
revoke all on function private.create_sim_racing_booking(date,time,text,text) from anon,authenticated;
create function public.create_sim_racing_booking(p_date date,p_start_time time,p_guest_phone text default null,p_guest_name text default null)
returns jsonb language sql security definer set search_path = '' as $$ select private.create_sim_racing_booking(p_date,p_start_time,p_guest_phone,p_guest_name); $$;
revoke all on function public.create_sim_racing_booking(date,time,text,text) from public;
grant execute on function public.create_sim_racing_booking(date,time,text,text) to anon,authenticated;

-- Staff can move/cancel a simulator reservation without changing its product,
-- price, payment receipts, venue, or capacity. The exclusion constraint also
-- covers staff edits, so simultaneous edits cannot double-book the machine.
create function private.staff_update_sim_racing_booking(p_session_id uuid,p_booking jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.sessions%rowtype; v_date date := (p_booking->>'date')::date; v_time time := (p_booking->>'start_time')::time; v_status text := p_booking->>'status';
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0) < 50 then raise exception 'Staff access required.'; end if;
  select * into v_session from public.sessions where id=p_session_id and confirmed_game_id='sim-racing' and deleted_at is null for update;
  if not found then raise exception 'SIM Racing booking not found.'; end if;
  if v_session.updated_at is distinct from (p_booking->>'expected_updated_at')::timestamptz then raise exception 'This booking has changed. Close and reopen it.'; end if;
  if v_date is null or v_time is null or v_status is null or v_status not in ('open','cancelled','completed') then raise exception 'Invalid booking details.'; end if;
  update public.sessions set date=v_date,start_time=v_time,status=v_status,ticket_status=case when v_status='open' then 'confirmed' else v_status end,
    notes=left(p_booking->>'notes',500) where id=p_session_id;
  update public.staff_orders set booking_date=v_date,booking_time=v_time,order_status=case when v_status='open' then case when payment_status='paid' then 'paid' else 'confirmed' end else v_status end
    where session_id=p_session_id;
  return jsonb_build_object('session_id',p_session_id);
exception when exclusion_violation then raise exception 'The simulator is already booked at this time.';
end $$;
revoke all on function private.staff_update_sim_racing_booking(uuid,jsonb) from public,anon;
revoke all on function private.staff_update_sim_racing_booking(uuid,jsonb) from authenticated;
create function public.staff_update_sim_racing_booking(p_session_id uuid,p_booking jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.staff_update_sim_racing_booking(p_session_id,p_booking); $$;
revoke all on function public.staff_update_sim_racing_booking(uuid,jsonb) from public,anon;
grant execute on function public.staff_update_sim_racing_booking(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
