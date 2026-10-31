begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values
 ('97000000-0000-4000-8000-000000000001','boundary-player@example.invalid'),
 ('97000000-0000-4000-8000-000000000002','boundary-admin@example.invalid'),
 ('97000000-0000-4000-8000-000000000003','boundary-owner@example.invalid');
insert into public.profiles(id,email,full_name,role)
select id,email,'Boundary fixture',case right(id::text,1) when '2' then 'admin' when '3' then 'owner' else 'player' end
from auth.users where id::text like '97000000-%'
on conflict(id) do update set role=excluded.role;
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
select gen_random_uuid(),id,'totp','verified','LOCAL-TEST-ONLY',now(),now() from auth.users where id::text like '97000000-%';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_ok($q$select * from public.profiles$q$,'42501',null,'Anonymous caller cannot read customer profiles');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*) from public.profiles where id::text like '97000000-%'),1::bigint,'Customer can read only their own private profile');
select throws_ok($q$update public.profiles set role='admin' where id='97000000-0000-4000-8000-000000000001'$q$,null,null,'Direct self-promotion rejected');
select throws_ok($q$update public.profiles set score_adjustment=999999 where id='97000000-0000-4000-8000-000000000001'$q$,null,null,'Direct score/grade inflation rejected');
select throws_ok($q$update public.profiles set loyalty_points_total=999999 where id='97000000-0000-4000-8000-000000000001'$q$,null,null,'Direct loyalty inflation rejected');
select throws_ok($q$select public.set_staff_profile_role('97000000-0000-4000-8000-000000000001','admin')$q$,null,null,'Role RPC rejects customer credentials');
select lives_ok($q$update public.profiles set nickname='Own nickname' where id='97000000-0000-4000-8000-000000000001'$q$,'Own ordinary profile edit works');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
select is(public.current_staff_role_rank(),100,'Admin fixture has verified admin credentials');
select throws_ok($q$update public.profiles set role='owner' where id='97000000-0000-4000-8000-000000000002'$q$,'42501',null,'Admin cannot self-promote to owner through direct write');
select throws_ok($q$update public.profiles set role='super_admin' where id='97000000-0000-4000-8000-000000000002'$q$,'42501',null,'Legacy owner alias cannot bypass guard');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select is(public.current_staff_role_rank(),120,'Owner fixture has verified owner credentials');
select lives_ok($q$select public.set_staff_profile_role('97000000-0000-4000-8000-000000000002','owner')$q$,'Verified owner can assign owner role through authorized RPC');
reset role;
select * from finish();
rollback;
