begin;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select public.create_sim_racing_booking((now() at time zone 'Asia/Ho_Chi_Minh')::date+10,'09:00','0900000099','SIM rollback test');
reset role;
do $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date+10; s public.sessions%rowtype;
begin
  select * into strict s from public.sessions where confirmed_game_id='sim-racing' and date=d;
  assert s.venue_key='ha-do-centrosa' and s.duration_minutes=15 and s.max_players=1 and s.arena_count=0 and s.ticket_total_price=150000;
  assert exists(select 1 from public.staff_orders where session_id=s.id and total=150000 and arena_id='sim-racing-1' and payment_status='unpaid' and booking_source='website');
  assert not exists(select 1 from public.sim_racing_available_times(d) where start_time='09:00');
  assert exists(select 1 from public.sim_racing_available_times(d) where start_time='09:15');
  begin
    perform public.create_sim_racing_booking(d,'09:00','0900000098','Second driver');
    raise exception 'TEST FAILED: duplicate permitted';
  exception when raise_exception then
    if SQLERRM <> 'This simulator slot was just booked. Please choose another time.' then raise; end if;
  end;
  begin
    perform public.create_sim_racing_booking(d,'09:05','0900000098','Wrong slot');
    raise exception 'TEST FAILED: non-grid slot permitted';
  exception when raise_exception then
    if SQLERRM <> 'Choose a 15-minute SIM Racing slot between 09:00 and 21:45.' then raise; end if;
  end;
  perform public.create_sim_racing_booking(d,'09:15','0900000098','Next driver');
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  begin
    update public.sessions set venue_key='cafe-des-stagiaires' where id=s.id;
    raise exception 'TEST FAILED: Thao Dien permitted';
  exception when check_violation then null; end;
  begin
    update public.sessions set duration_minutes=30 where id=s.id;
    raise exception 'TEST FAILED: wrong duration permitted';
  exception when check_violation then null; end;
  update public.sessions set status='cancelled',ticket_status='cancelled' where id=s.id;
  assert exists(select 1 from public.sim_racing_available_times(d) where start_time='09:00');
end $$;
select 'SIM Racing: price, duration, venue, capacity, adjacent slots, guest access, and cancellation verified' as result;

rollback;
