begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values ('85000000-0000-4000-8000-000000000001','booking-admin@example.invalid');
insert into public.profiles(id,full_name,role) values ('85000000-0000-4000-8000-000000000001','Booking test admin','admin') on conflict(id) do update set role='admin';
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values ('85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000001','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.staff_games(id,slug,name,game_type,duration_minutes,max_players_per_arena,available_arena_ids,active)
values ('85000000-0000-4000-8000-000000000003','city-z','City Z fixture','shooting',45,6,array['arena-1','arena-2'],true),
('85000000-0000-4000-8000-000000000004','booking-hado-fixture','Ha Do fixture','shooting',20,4,array['arena-1','arena-2'],true)
on conflict(slug) do update set duration_minutes=excluded.duration_minutes,active=true;
create temp table booking_results(label text, result jsonb);
grant all on booking_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal1"}',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal2"}',true);
create function pg_temp.event_payload(t text, mins int, outside boolean default true) returns jsonb language sql as $$
select jsonb_build_object('p_booking_kind','event','p_duration_minutes',mins,'p_allow_outside_hours',outside,
'p_game_id',(select id from public.staff_games where slug='city-z'),'p_booking_date',current_date+213,'p_booking_time',t,
'p_players_count',5,'p_arena_id','cafe:arena-1','p_order_status','confirmed','p_contact_name','Event coordinator','p_internal_note','Prepare room early'); $$;
select throws_ok($q$select public.staff_create_booking(pg_temp.event_payload('10:13',127,false),'phone')$q$,'P0001','Selected time is outside opening hours.','Explicit outside-hours permission is required');
insert into booking_results values ('event',public.staff_create_booking(pg_temp.event_payload('10:13',127),'phone'));
select is((select duration_minutes from public.sessions where id=(select (result->>'session_id')::uuid from booking_results where label='event')),127,'Event reserves the exact manual duration');
select ok((select internal_note like '%Contact person: Event coordinator%' and internal_note like '%Prepare room early%' from public.staff_orders where id=(select (result->>'order_id')::uuid from booking_results where label='event')),'Contact person and special requests persist');
select is(public.staff_booking_availability(current_date+213,'12:19','cafe:arena-1',45),false,'Availability covers the end of the event');
select is(public.staff_booking_availability(current_date+213,'12:20','cafe:arena-1',45),true,'Adjacent booking starts at exact event end');
select throws_ok($q$select public.staff_create_booking(pg_temp.event_payload('12:19',45),'phone')$q$,'P0001','This arena is already booked at the selected time. Choose another arena or time.','Confirmation rejects overlap at the end of an event');
select throws_ok($q$select public.staff_create_booking(pg_temp.event_payload('23:00',61),'phone')$q$,'P0001','Booking must finish by midnight.','Cross-midnight reservation is rejected');
insert into booking_results values ('midnight',public.staff_create_booking(pg_temp.event_payload('23:00',60),'phone'));
select is(public.staff_booking_availability(current_date+213,'23:59','cafe:arena-1',1),false,'Midnight boundary remains unavailable');
select throws_ok($q$select public.staff_create_booking(pg_temp.event_payload('16:00',0),'phone')$q$,'P0001','Invalid reserved duration.','Zero duration rejected');
select throws_ok($q$select public.staff_create_booking(pg_temp.event_payload('16:00',60)||'{"p_booking_kind":"standard"}'::jsonb,'phone')$q$,'P0001','Custom duration and outside-hours booking require event type.','Standard bookings cannot bypass opening hours');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal1"}',true);
select throws_ok($q$select public.staff_booking_availability(current_date+213,'16:00','cafe:arena-1',45)$q$,'P0001','Staff access required.','Availability requires staff MFA');
select throws_ok($q$select public.staff_create_booking(pg_temp.event_payload('16:00',60),'phone')$q$,'P0001','Staff access required.','Event creation requires staff MFA');
reset role;
select * from finish();
rollback;
