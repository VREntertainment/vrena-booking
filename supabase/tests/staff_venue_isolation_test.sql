begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values
 ('95000000-0000-4000-8000-000000000001','venue-admin@example.invalid'),
 ('95000000-0000-4000-8000-000000000002','venue-named@example.invalid'),
 ('95000000-0000-4000-8000-000000000003','venue-hado@example.invalid'),
 ('95000000-0000-4000-8000-000000000004','venue-td@example.invalid'),
 ('95000000-0000-4000-8000-000000000005','venue-customer-hd@example.invalid'),
 ('95000000-0000-4000-8000-000000000006','venue-customer-td@example.invalid');
insert into auth.users(id,email) select '95000000-0000-4000-8000-000000000007','contact@vre-vietnam.com' where not exists(select 1 from auth.users where email='contact@vre-vietnam.com');
insert into public.profiles(id,full_name,role) select id,'Venue boundary test',case when id='95000000-0000-4000-8000-000000000001' then 'admin' when id='95000000-0000-4000-8000-000000000002' then 'viewer' else 'player' end from auth.users where id::text like '95000000%' or email='contact@vre-vietnam.com' on conflict(id) do update set role=excluded.role;
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
select gen_random_uuid(),id,'totp','verified','LOCAL-TEST-ONLY',now(),now() from auth.users where id in ('95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002');
insert into public.staff_employee_profiles(profile_id,legal_name,department,active,kiosk_access_role)
values ('95000000-0000-4000-8000-000000000002','Named staff','VRena',true,null),
 ('95000000-0000-4000-8000-000000000003','HaDo staff','VRena',true,'staff'),
 ('95000000-0000-4000-8000-000000000004','TD manager','VRena',true,'manager');
insert into public.staff_employee_locations values
 ('95000000-0000-4000-8000-000000000002','ha-do-centrosa'),
 ('95000000-0000-4000-8000-000000000003','ha-do-centrosa'),
 ('95000000-0000-4000-8000-000000000004','cafe-des-stagiaires');
insert into private.staff_kiosk_pin_credentials(profile_id,pin_hash,access_role) values
 ('95000000-0000-4000-8000-000000000003','TEST ONLY','staff'),('95000000-0000-4000-8000-000000000004','TEST ONLY','manager');
insert into private.staff_kiosk_operator_sessions(auth_user_id,operator_profile_id,access_role,token_hash)
select u.id,v.id::uuid,v.role,encode(extensions.digest(v.token,'sha256'),'hex') from auth.users u cross join
 (values ('95000000-0000-4000-8000-000000000003','staff','local-hd-token'),('95000000-0000-4000-8000-000000000004','manager','local-td-token')) v(id,role,token)
 where u.email='contact@vre-vietnam.com';
create temp table venue_fixture(label text primary key,value jsonb);
grant all on venue_fixture to authenticated;
insert into venue_fixture values('shared',jsonb_build_object('id',(select id from auth.users where email='contact@vre-vietnam.com')));
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"95000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
insert into venue_fixture values('hd',public.staff_create_booking(jsonb_build_object('p_customer_id','95000000-0000-4000-8000-000000000005','p_game_id',(select id from public.staff_games where slug='city-z'),'p_booking_date',current_date+100,'p_booking_time','16:00','p_players_count',1,'p_arena_id','arena-1','p_order_status','confirmed','p_payment_splits',jsonb_build_array(jsonb_build_object('payment_method','cash','amount',100000))),'walk_in'));
insert into venue_fixture values('td',public.staff_create_booking(jsonb_build_object('p_customer_id','95000000-0000-4000-8000-000000000006','p_game_id',(select id from public.staff_games where slug='city-z'),'p_booking_date',current_date+100,'p_booking_time','16:00','p_players_count',1,'p_arena_id','cafe:arena-1','p_order_status','confirmed','p_payment_splits',jsonb_build_array(jsonb_build_object('payment_method','cash','amount',100000))),'walk_in'));
select is((select count(*)::int from public.staff_access_locations()),2,'Admin has both venues');
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select value->>'id' from venue_fixture where label='shared'),'aal','aal1')::text,true);
select set_config('request.headers','{"x-vrena-operator-session":"local-hd-token"}',true);
select is(public.current_staff_role_rank(),50,'Real kiosk authentication resolves HaDo staff');
select is((select array_agg(venue_key) from public.staff_access_locations()),array['ha-do-centrosa'],'HaDo staff sees only assigned location');
select is((select count(*)::int from public.sessions where id=(select (value->>'session_id')::uuid from venue_fixture where label='hd')),1,'HaDo session allowed');
select is((select count(*)::int from public.sessions where id=(select (value->>'session_id')::uuid from venue_fixture where label='td')),0,'HaDo cannot read TD sessions');
select is((select count(*)::int from public.staff_orders where id=(select (value->>'order_id')::uuid from venue_fixture where label='td')),0,'HaDo cannot read TD orders');
select is((select count(*)::int from public.staff_order_payments where order_id=(select (value->>'order_id')::uuid from venue_fixture where label='td')),0,'HaDo cannot read TD payments');
select is((select count(*)::int from public.profiles where id='95000000-0000-4000-8000-000000000006'),0,'HaDo cannot read TD customer');
select is((select count(*)::int from public.profile_search(null,500,0,'all',false,'name_asc') where id='95000000-0000-4000-8000-000000000006'),0,'Definer profile search hides TD customer');
select ok(not private.staff_location_session_allowed((select (value->>'session_id')::uuid from venue_fixture where label='td')),'Session management helper denies other venue');
select throws_ok($q$select public.staff_set_employee_locations('95000000-0000-4000-8000-000000000003',array['ha-do-centrosa','cafe-des-stagiaires'])$q$,'P0001','Administrator access required.','Employee cannot self-assign venues');
select throws_ok($q$update public.staff_employee_locations set venue_key='cafe-des-stagiaires' where profile_id='95000000-0000-4000-8000-000000000003'$q$,'42501',null,'Direct membership update denied');
select throws_ok($q$update public.sessions set venue_key='cafe-des-stagiaires' where id=(select (value->>'session_id')::uuid from venue_fixture where label='hd')$q$,'P0001','Location access denied.','Direct cross-location transfer denied');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+101,'16:00',1,'cafe:arena-1',null,'confirmed')$q$,'P0001','Location access denied.','Legacy creation RPC cannot create at other venue');
select lives_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+101,'16:00',1,'arena-1',null,'confirmed')$q$,'Own-venue staff creation preserved');
select is((public.staff_orders_page(current_date+100,current_date+100,50,0,null,null)->>'totalCount')::int,1,'Paged orders totals scoped');
select is((select count(*)::int from public.audit_logs),0,'Scoped staff cannot read global audit snapshots');
select throws_ok($q$update public.staff_orders set customer_id='95000000-0000-4000-8000-000000000006' where id=(select (value->>'order_id')::uuid from venue_fixture where label='hd')$q$,'P0001','Customer location access denied.','Cannot steal customer access by relinking an allowed order');
select throws_ok($q$update public.sessions set ticket_customer_id='95000000-0000-4000-8000-000000000006' where id=(select (value->>'session_id')::uuid from venue_fixture where label='hd')$q$,'P0001','Customer location access denied.','Cannot steal customer access through ticket customer');
select set_config('request.headers','{"x-vrena-operator-session":"local-td-token"}',true);
select is(public.current_staff_role_rank(),80,'Real kiosk authentication resolves TD manager');
select is((select count(*)::int from public.sessions where id=(select (value->>'session_id')::uuid from venue_fixture where label='hd')),0,'TD cannot read HaDo sessions');
select is((select count(*)::int from public.staff_orders where id=(select (value->>'order_id')::uuid from venue_fixture where label='hd')),0,'TD cannot read HaDo orders');
select is((select count(*)::int from public.staff_orders where id=(select (value->>'order_id')::uuid from venue_fixture where label='td')),1,'TD own order allowed');
select set_config('request.headers','{}',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"95000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
select is(public.current_staff_role_rank(),20,'Named MFA viewer resolves rank20');
select is((select count(*)::int from public.staff_orders where id=(select (value->>'order_id')::uuid from venue_fixture where label='td')),0,'Rank20 viewer cannot bypass location scope');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"95000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select lives_ok($q$select public.staff_set_employee_locations('95000000-0000-4000-8000-000000000003',array['ha-do-centrosa','cafe-des-stagiaires'])$q$,'Admin can assign multiple venues');
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select value->>'id' from venue_fixture where label='shared'),'aal','aal1')::text,true);
select set_config('request.headers','{"x-vrena-operator-session":"local-hd-token"}',true);
select is((select count(*)::int from public.staff_access_locations()),2,'Existing operator session receives new multi-location assignment');
select is((select count(*)::int from public.staff_orders where id in(select (value->>'order_id')::uuid from venue_fixture where label in ('hd','td'))),2,'Multi-location operator reads both');
reset role;
delete from public.staff_employee_locations where profile_id='95000000-0000-4000-8000-000000000003';
set local role authenticated;
select is((select count(*)::int from public.staff_access_locations()),0,'Revocation takes effect without logging out');
select is((select count(*)::int from public.staff_orders),0,'No assignment fails closed');
select is((select count(*)::int from public.profiles where id=auth.uid()),1,'Unassigned operator can still load the shared sign-in profile');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+102,'16:00',1,'arena-1',null,'confirmed')$q$,'P0001','Location access denied.','Unassigned employee cannot create bookings');
reset role;
select ok(not has_table_privilege('authenticated','staff_location_scope.sessions','select'),'Scoped definer views cannot be read directly');
select * from finish();
rollback;
