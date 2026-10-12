begin;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select lives_ok($q$insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key)
  values('Atomic fixture TD',current_date+1000,'16:00',60,2,1,'cafe-des-stagiaires')$q$, 'First Thao Dien arena is reserved');
select throws_ok($q$insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key)
  values('Atomic conflict',current_date+1000,'16:30',60,2,1,'cafe-des-stagiaires')$q$,
  '23P01','Selected time slot is no longer available. Choose another arena or time.','Direct overlapping write is rejected');
select lives_ok($q$insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key)
  values('Atomic adjacent',current_date+1000,'17:00',60,2,1,'cafe-des-stagiaires')$q$, 'End is exclusive: adjacent booking succeeds');
select throws_ok($q$update public.sessions set start_time='16:30' where name='Atomic adjacent'$q$,
  '23P01','Selected time slot is no longer available. Choose another arena or time.','Overlapping edit rolls back');
select is((select start_time::time from public.sessions where name='Atomic adjacent'),time '17:00','Rejected move preserves original time');
select lives_ok($q$insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key)
  values('Atomic HD one',current_date+1000,'16:00',60,2,1,'ha-do-centrosa'),
        ('Atomic HD two',current_date+1000,'16:00',60,2,1,'ha-do-centrosa')$q$, 'Ha Do has two independent arenas');
select throws_ok($q$insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key)
  values('Atomic HD three',current_date+1000,'16:00',60,2,1,'ha-do-centrosa')$q$,
  '23P01','Selected time slot is no longer available. Choose another arena or time.','Ha Do rejects a third arena');
select throws_ok($q$insert into public.blocked_times(date,start_time,end_time,arenas_used)
  values(current_date+1000,'16:30','17:00',1)$q$,
  '23P01','Selected time slot is no longer available. Choose another arena or time.','Blocked time cannot overbook existing sessions');
update public.sessions set status='cancelled' where name='Atomic fixture TD';
select lives_ok($q$insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key)
  values('Atomic replacement',current_date+1000,'16:00',60,2,1,'cafe-des-stagiaires')$q$, 'Cancellation releases the arena');
select ok(not has_table_privilege('anon','private.arena_reservations','INSERT'),'Anonymous callers cannot write reservation ledger');
select ok(not has_function_privilege('authenticated','private.reserve_arenas(uuid,uuid,text,timestamp,timestamp,integer,integer)','EXECUTE'),'Private allocator cannot be called by customers');
select ok(has_function_privilege('anon','public.booking_arena_occupancy(date,date)','EXECUTE'),'Customers can read non-identifying occupancy');
select * from finish();
rollback;
