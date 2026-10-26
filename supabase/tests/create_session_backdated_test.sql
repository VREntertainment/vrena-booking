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
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select value->>'id' from venue_fixture where label='shared'),'aal','aal1')::text,true);
select set_config('request.headers','{"x-vrena-operator-session":"local-hd-token"}',true);
-- Same two-request contract as Create Session: insert with a known ID, then read.
select lives_ok($q$insert into public.sessions(id,owner_id,name,date,start_time,max_players,game_options,arena_count) values('96000000-0000-4000-8000-000000000001',auth.uid(),'Backdated staff session',current_date-200,'10:00',2,array['laser-tag'],2)$q$,'Assigned staff can create a backdated session without RETURNING');
select is((select count(*)::int from public.sessions where id='96000000-0000-4000-8000-000000000001'),1,'Created historical session is readable on the next request');
select lives_ok($q$insert into public.session_participants(session_id,profile_id,display_name) values('96000000-0000-4000-8000-000000000001',auth.uid(),'Regression staff')$q$,'Creator can join the saved historical session');
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options,venue_key) values(auth.uid(),'Wrong venue',current_date-200,'11:00',2,array['laser-tag'],'cafe-des-stagiaires')$q$,'P0001','Location access denied.','Backdating does not bypass assigned venue');
select lives_ok($q$insert into public.sessions(id,owner_id,name,date,start_time,max_players,game_options,arena_count) values('96000000-0000-4000-8000-000000000002',auth.uid(),'Future staff session',current_date+200,'10:00',2,array['laser-tag'],2)$q$,'Future creation still works');
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values(auth.uid(),'Future conflict',current_date+200,'10:00',2,array['laser-tag'])$q$,'23P01','Selected time slot is no longer available. Choose another arena or time.','Future overlap remains rejected');
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values('95000000-0000-4000-8000-000000000003','Spoofed owner',current_date-201,'11:00',2,array['laser-tag'])$q$,'42501',null,'Owner spoofing remains rejected');
reset role;
delete from public.staff_employee_locations where profile_id='95000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($q$insert into public.sessions(owner_id,name,date,start_time,max_players,game_options) values(auth.uid(),'Unassigned staff',current_date-202,'11:00',2,array['laser-tag'])$q$,'P0001','Location access denied.','Unassigned staff cannot backdate');
reset role;
select * from finish();
rollback;
