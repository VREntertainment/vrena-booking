begin;
select plan(4);
select ok(not exists (select 1 from public.sim_racing_available_times(current_date+30) where start_time > '21:30'), 'SIM Racing never offers starts after 21:30');
select ok(position('21:30' in pg_get_functiondef('private.create_sim_racing_booking(date,time,text,text)'::regprocedure)) > 0, 'SIM Racing creation enforces cutoff');
select ok(position('21:45' in pg_get_functiondef('private.set_sim_racing_slot()'::regprocedure)) = 0, 'SIM Racing trigger no longer permits 21:45');
select ok(position('21:30' in pg_get_functiondef('private.staff_update_calendar_booking(uuid,jsonb)'::regprocedure)) > 0, 'Staff calendar enforces venue cutoff');
select * from finish();
rollback;
