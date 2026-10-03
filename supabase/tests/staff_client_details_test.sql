begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values ('85000000-0000-4000-8000-000000000071','details-admin@example.invalid'),('85000000-0000-4000-8000-000000000072','details-client@example.invalid');
insert into public.profiles(id,full_name,role,nickname,loyalty_points_total) values
('85000000-0000-4000-8000-000000000071','Details admin','admin','details-admin',0),
('85000000-0000-4000-8000-000000000072','Original client','player','details-client',42)
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,nickname=excluded.nickname,loyalty_points_total=excluded.loyalty_points_total;
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values ('85000000-0000-4000-8000-000000000073','85000000-0000-4000-8000-000000000071','totp','verified','LOCAL-TEST-ONLY',now(),now());
select ok(not has_function_privilege('anon','public.staff_save_client_profile_v4(uuid,integer,jsonb,jsonb,jsonb,text,uuid[],jsonb,boolean)','execute'),'Anonymous users cannot save clients');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000072","aal":"aal1"}',true);
select throws_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_details=>'{}',p_save_stats=>false)$q$,'P0001','Staff access required.','Ordinary clients cannot use staff editing');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000071","aal":"aal1"}',true);
select throws_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_details=>'{}',p_save_stats=>false)$q$,'P0001','Staff access required.','Staff MFA is enforced');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000071","aal":"aal2"}',true);
select lives_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_details=>'{"full_name":"New Given Surname","nickname":"details-renamed","phone":"+84900000712","email":"new-details@example.invalid","birthday":"2000-02-29","gender":"female","profile_motto":"Play together"}',p_save_stats=>false)$q$,'Staff can save all personal details');
select is((select full_name from public.profiles where id='85000000-0000-4000-8000-000000000072'),'New Given Surname','Name and surname persist');
select is((select birthday::text from public.profiles where id='85000000-0000-4000-8000-000000000072'),'2000-02-29','Birthday persists');
select is((select loyalty_points_total from public.profiles where id='85000000-0000-4000-8000-000000000072'),42,'Details-only save preserves stats');
select throws_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_details=>'{"role":"admin"}',p_save_stats=>false)$q$,'P0001','This profile field cannot be edited here: role','Role escalation is rejected');
select throws_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_details=>'{"nickname":"details-admin","full_name":"Should roll back"}',p_save_stats=>false)$q$,'23505','Player nickname is already in use.','Duplicate nicknames reject the complete save');
select is((select full_name from public.profiles where id='85000000-0000-4000-8000-000000000072'),'New Given Surname','Failed save leaves original data intact');
select throws_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_details=>'{"birthday":"2999-01-01"}',p_save_stats=>false)$q$,'P0001','Enter a valid date of birth.','Future birthday rejected');
select throws_ok($q$select public.staff_save_client_profile_v4('85000000-0000-4000-8000-000000000072',0,'{}','[]',p_achievement_changes=>'{}',p_details=>'{"full_name":"Must roll back with stats"}',p_save_stats=>true)$q$,'P0001','Achievement changes must be an array.','Stats validation also rolls back personal details');
select is((select full_name from public.profiles where id='85000000-0000-4000-8000-000000000072'),'New Given Surname','Combined save is atomic');
reset role;
select is((select count(*)::integer from public.audit_logs where entity_id='85000000-0000-4000-8000-000000000072' and action='staff_client_details_updated'),1,'Successful change is audited once');
select * from finish();
rollback;
