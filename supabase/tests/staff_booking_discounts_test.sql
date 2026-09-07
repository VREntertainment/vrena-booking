begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values ('88000000-0000-4000-8000-000000000001','discount-admin@example.invalid');
insert into public.profiles(id,full_name,role) values ('88000000-0000-4000-8000-000000000001','Discount test admin','admin') on conflict(id) do update set role='admin';
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values ('88000000-0000-4000-8000-000000000002','88000000-0000-4000-8000-000000000001','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.staff_games(id,slug,name,game_type,duration_minutes,max_players_per_arena,available_arena_ids,active)
values ('88000000-0000-4000-8000-000000000003','city-z','City Z fixture','shooting',20,6,array['arena-1','arena-2'],true)
on conflict(slug) do update set active=true;
insert into public.staff_discount_rules(name,discount_type,value,min_players,max_players,ticket_type,valid_from,active) values
('QA Group 5-8','percentage',10,5,8,'all','2020-01-01',true),
('QA Group 9-16','percentage',15,9,16,'all','2020-01-01',true),
('QA Birthday','percentage',10,null,null,'birthday','2020-01-01',true);
insert into public.staff_discount_rules(name,code,discount_type,value,ticket_type,valid_from,active) values ('QA Affiliate','VR_QA_AFFILIATE','percentage',10,'all','2020-01-01',true);
create temp table discount_results(method text, result jsonb);
grant all on discount_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"88000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal2"}',true);
insert into discount_results
select players::text,public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+122,booking_time,players,'cafe:arena-1',null,'confirmed')
from (values (4,'16:00'::time),(5,'17:00'::time),(9,'18:00'::time),(16,'19:00'::time)) as fixtures(players,booking_time);
select is((select (result->>'total')::int from discount_results where method='4'),960000,'Four players are below the configured group threshold');
select is((select (result->>'total')::int from discount_results where method='5'),1080000,'Five players receive the configured 10 percent group discount');
select is((select (result->>'total')::int from discount_results where method='9'),1836000,'Nine players receive the configured 15 percent group discount');
select is((select (result->>'total')::int from discount_results where method='16'),3264000,'Sixteen players retain the configured 15 percent group discount');
insert into discount_results values ('birthday',public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+123,'16:00',4,'cafe:arena-1',(select id from public.staff_discount_rules where name='QA Birthday'),'confirmed'));
select is((select (result->>'total')::int from discount_results where method='birthday'),864000,'Staff can select the configured birthday offer');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+123,'17:00',4,'cafe:arena-1',(select id from public.staff_discount_rules where code='VR_QA_AFFILIATE'),'confirmed')$q$,'P0001','Discount is not active.','Affiliate codes cannot be submitted as staff discounts');
insert into discount_results values ('override-request',jsonb_build_object('p_game_id',(select id from public.staff_games where slug='city-z'),'p_booking_date',current_date+124,'p_booking_time','16:00','p_players_count',5,'p_arena_id','cafe:arena-1','p_order_status','paid','p_total_override',1000000,'p_payment_splits',jsonb_build_array(jsonb_build_object('payment_method','card_manual','amount',1000000))));
select throws_ok($q$select public.staff_create_booking((select result from discount_results where method='override-request'),'walk_in')$q$,'P0001','A reason is required for a price override.','Override reason is enforced on the server');
select is((select count(*)::int from public.staff_orders where booking_date=current_date+124),0,'Missing reason leaves no booking or receipt');
select throws_ok($q$select public.staff_create_booking((select result||'{"p_total_override":999999,"p_override_reason":"Test"}'::jsonb from discount_results where method='override-request'),'walk_in')$q$,'P0001','Payment exceeds the final total.','Override cannot reduce total below payments');
insert into discount_results values ('override',public.staff_create_booking((select result||'{"p_override_reason":"Agreed group package"}'::jsonb from discount_results where method='override-request'),'walk_in'));
select is((select (result->>'total')::int from discount_results where method='override'),1000000,'Override is the confirmed final total');
select is((select price_override_original_total from public.staff_orders where id=(select (result->>'order_id')::uuid from discount_results where method='override')),1080000,'Original total includes the automatic group discount');
select is((select price_override_reason from public.staff_orders where id=(select (result->>'order_id')::uuid from discount_results where method='override')),'Agreed group package','Required reason is stored with the order');
select is((select ticket_total_price from public.sessions where id=(select (result->>'session_id')::uuid from discount_results where method='override')),1000000,'Linked calendar booking uses the overridden total');
select is((select payment_status from public.staff_orders where id=(select (result->>'order_id')::uuid from discount_results where method='override')),'paid','Override payment status reconciles with its receipt');
select ok((select internal_note like '%Agreed group package%' from public.staff_orders where id=(select (result->>'order_id')::uuid from discount_results where method='override')),'Reason is visible in the existing order note');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+125,'15:59',1,'cafe:arena-1',null,'confirmed')$q$,'P0001','Selected time is outside opening hours.','Cafe cannot book before its own opening time');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+125,'21:59',1,'arena-1',null,'confirmed')$q$,'P0001','Selected time is outside opening hours.','A booking must finish before closing');
reset role;
select * from finish();
rollback;
