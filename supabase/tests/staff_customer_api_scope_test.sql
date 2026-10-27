begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values
 ('96000000-0000-4000-8000-000000000001','scope-admin@example.invalid'),
 ('96000000-0000-4000-8000-000000000002','scope-named@example.invalid'),
 ('96000000-0000-4000-8000-000000000003','scope-hado@example.invalid'),
 ('96000000-0000-4000-8000-000000000004','scope-td@example.invalid'),
 ('96000000-0000-4000-8000-000000000005','scope-customer-hd@example.invalid'),
 ('96000000-0000-4000-8000-000000000006','scope-customer-td@example.invalid');
insert into auth.users(id,email) select '96000000-0000-4000-8000-000000000007','contact@vre-vietnam.com' where not exists(select 1 from auth.users where email='contact@vre-vietnam.com');
insert into public.profiles(id,full_name,role) select id,'Venue boundary test',case when id='96000000-0000-4000-8000-000000000001' then 'admin' when id='96000000-0000-4000-8000-000000000002' then 'viewer' else 'player' end from auth.users where id::text like '96000000%' or email='contact@vre-vietnam.com' on conflict(id) do update set role=excluded.role;
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
select gen_random_uuid(),id,'totp','verified','LOCAL-TEST-ONLY',now(),now() from auth.users where id in ('96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002');
insert into public.staff_employee_profiles(profile_id,legal_name,department,active,kiosk_access_role)
values ('96000000-0000-4000-8000-000000000002','Named staff','VRena',true,null),
 ('96000000-0000-4000-8000-000000000003','HaDo staff','VRena',true,'staff'),
 ('96000000-0000-4000-8000-000000000004','TD manager','VRena',true,'manager');
insert into public.staff_employee_locations values
 ('96000000-0000-4000-8000-000000000002','ha-do-centrosa'),
 ('96000000-0000-4000-8000-000000000003','ha-do-centrosa'),
 ('96000000-0000-4000-8000-000000000004','cafe-des-stagiaires');
insert into private.staff_kiosk_pin_credentials(profile_id,pin_hash,access_role) values
 ('96000000-0000-4000-8000-000000000003','TEST ONLY','staff'),('96000000-0000-4000-8000-000000000004','TEST ONLY','manager');
insert into private.staff_kiosk_operator_sessions(auth_user_id,operator_profile_id,access_role,token_hash)
select u.id,v.id::uuid,v.role,encode(extensions.digest(v.token,'sha256'),'hex') from auth.users u cross join
 (values ('96000000-0000-4000-8000-000000000003','staff','scope-hd-token'),('96000000-0000-4000-8000-000000000004','manager','scope-td-token')) v(id,role,token)
 where u.email='contact@vre-vietnam.com';
create temp table venue_fixture(label text primary key,value jsonb);
grant all on venue_fixture to authenticated;
insert into venue_fixture values('shared',jsonb_build_object('id',(select id from auth.users where email='contact@vre-vietnam.com')));

insert into private.staff_customer_locations(profile_id,venue_key) values
 ('96000000-0000-4000-8000-000000000005','ha-do-centrosa'),
 ('96000000-0000-4000-8000-000000000006','cafe-des-stagiaires');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select value->>'id' from venue_fixture where label='shared'),'aal','aal1')::text,true);
select set_config('request.headers','{"x-vrena-operator-session":"scope-hd-token"}',true);
select is(public.current_staff_role_rank(),50,'Kiosk scope uses the verified HaDo operator');
select ok(public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000005'),'Staff can access own venue customer');
select ok(not public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000006'),'Staff cannot edit or rotate another venue customer');
select ok(not public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000003'),'Employee accounts cannot be treated as customers');
select throws_ok($q$select public.service_register_staff_customer_locations('96000000-0000-4000-8000-000000000006',array['ha-do-centrosa'])$q$,'42501',null,'Staff cannot self-assign a customer');
select set_config('request.headers','{"x-vrena-operator-session":"scope-td-token"}',true);
select ok(public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000006'),'TD manager can access own customer');
select ok(not public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000005'),'TD manager cannot access HaDo customer');
select set_config('request.headers','{}',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select ok(public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000006'),'Administrator retains cross-location customer access');
select ok(not public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000001'),'Administrator must use HR for privileged profiles');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000005","aal":"aal1"}',true);
select ok(not public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000005'),'Player cannot use staff customer API even for self');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values('96000000-0000-4000-8000-000000000008','new-scope-customer@example.invalid');
insert into public.profiles(id,full_name,role) values('96000000-0000-4000-8000-000000000008','New API customer','player');
select lives_ok($q$select public.service_register_staff_customer_locations('96000000-0000-4000-8000-000000000008',array['ha-do-centrosa'])$q$,'Service can link the new customer to caller-verified venues');
select throws_ok($q$select public.service_register_staff_customer_locations('96000000-0000-4000-8000-000000000008',array[]::text[])$q$,'P0001','Valid customer locations required.','Empty creation scope fails closed');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select value->>'id' from venue_fixture where label='shared'),'aal','aal1')::text,true);
select set_config('request.headers','{"x-vrena-operator-session":"scope-hd-token"}',true);
select ok(public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000008'),'Newly created customer is accessible before first booking');
reset role;
delete from public.staff_employee_locations where profile_id='96000000-0000-4000-8000-000000000003';
set local role authenticated;
select ok(not public.staff_customer_profile_allowed('96000000-0000-4000-8000-000000000008'),'Revoked assignment immediately blocks customer access');
reset role;
select * from finish();
rollback;
