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
insert into private.staff_customer_locations(profile_id,venue_key) values ('95000000-0000-4000-8000-000000000005','ha-do-centrosa');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"95000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select value->>'id' from venue_fixture where label='shared'),'aal','aal1')::text,true);
select set_config('request.headers','{"x-vrena-operator-session":"local-hd-token"}',true);
-- Direct table inserts are the public form, even when a staff account calls it.
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values(auth.uid(),'Public backdate',current_date-200,'10:00',2,array['laser-tag'])$q$,'42501',null,'Staff cannot backdate through the public insert path');
insert into venue_fixture values('past',public.staff_create_booking(jsonb_build_object('p_customer_id','95000000-0000-4000-8000-000000000005','p_game_id',(select id from public.staff_games where slug='laser-limbo'),'p_booking_date',current_date-200,'p_booking_time','10:00','p_players_count',1,'p_arena_id','arena-1','p_order_status','confirmed','p_payment_splits',jsonb_build_array(jsonb_build_object('payment_method','cash','amount',100000))),'walk_in'));
select is((select count(*)::int from public.sessions where id=(select (value->>'session_id')::uuid from venue_fixture where label='past')),1,'Staff Console backdated session is saved and readable');
select throws_ok($q$select public.staff_create_booking(jsonb_build_object('p_customer_id','95000000-0000-4000-8000-000000000005','p_game_id',(select id from public.staff_games where slug='city-z'),'p_booking_date',current_date-200,'p_booking_time','16:00','p_players_count',1,'p_arena_id','cafe:arena-1','p_order_status','confirmed'),'walk_in')$q$,'P0001','Location access denied.','Staff Console backdating remains venue scoped');
select lives_ok($q$insert into public.sessions(id,owner_id,name,date,start_time,max_players,game_options,arena_count) values('96000000-0000-4000-8000-000000000002',auth.uid(),'Future staff session',current_date+200,'10:00',2,array['laser-tag'],2)$q$,'Future public creation still works');
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values(auth.uid(),'Future conflict',current_date+200,'10:00',2,array['laser-tag'])$q$,'23P01','Selected time slot is no longer available. Choose another arena or time.','Future overlap remains rejected');
reset role;
delete from public.staff_employee_locations where profile_id='95000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='laser-limbo'),current_date-202,'16:00',1,'arena-1',null,'confirmed')$q$,'P0001','Location access denied.','Unassigned staff cannot backdate');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.headers','{}',true);
update public.profiles set phone='0981234567' where id='95000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.headers','{}',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"95000000-0000-4000-8000-000000000005","aal":"aal1"}',true);
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values(auth.uid(),'Player backdate',current_date-201,'11:00',2,array['laser-tag'])$q$,'42501',null,'Player cannot create a past session directly');
select throws_ok($q$select public.staff_create_booking('{}'::jsonb,'walk_in')$q$,'P0001','Staff access required.','Player cannot use the Staff Console creation RPC');
select lives_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values(auth.uid(),'Player future session',current_date+201,'11:00',2,array['laser-tag'])$q$,'Player can still create a future session');
reset role;
select * from finish();
rollback;
