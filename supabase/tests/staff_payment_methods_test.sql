begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values ('87000000-0000-4000-8000-000000000001','payment-method-admin@example.invalid');
insert into public.profiles(id,full_name,role) values ('87000000-0000-4000-8000-000000000001','Payment methods admin','admin') on conflict(id) do update set role='admin';
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values ('87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000001','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.staff_games(id,slug,name,game_type,duration_minutes,max_players_per_arena,available_arena_ids,active)
values ('87000000-0000-4000-8000-000000000003','city-z','City Z fixture','shooting',20,6,array['arena-1','arena-2'],true)
on conflict(slug) do update set active=true;
create temp table payment_method_results(method text, result jsonb);
grant all on payment_method_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"87000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal2"}',true);
insert into payment_method_results
select method,public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+121,booking_time,1,'cafe:arena-1',null,'paid',p_payment_splits=>jsonb_build_array(jsonb_build_object('payment_method',method,'amount',240000)))
from (values ('card_manual','16:00'::time),('momo_manual','17:00'::time),('vnpay','18:00'::time)) as fixtures(method,booking_time);
select is((select count(*)::int from payment_method_results),3,'All three new methods create bookings');
select is((select count(*)::int from public.staff_orders o join payment_method_results r on o.id=(r.result->>'order_id')::uuid where o.payment_method=r.method and o.payment_status='paid'),3,'Each method stays distinct and fully paid on its order');
select is((select count(*)::int from public.staff_order_payments p join payment_method_results r on p.order_id=(r.result->>'order_id')::uuid where p.payment_method=r.method and p.amount=240000),3,'Each receipt preserves its actual method and amount');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+121,'19:00',1,'cafe:arena-1',null,'paid',p_payment_splits=>'[{"payment_method":"credit_card","amount":240000}]')$q$,'P0001','Invalid split payment method.','Separate credit card method is rejected');
select throws_ok($q$select public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+121,'19:00',1,'cafe:arena-1',null,'paid',p_payment_splits=>'[{"payment_method":"debit_card","amount":240000}]')$q$,'P0001','Invalid split payment method.','Separate debit card method is rejected');
insert into payment_method_results values ('mixed',public.create_staff_order_with_payments(null,null,null,null,(select id from public.staff_games where slug='city-z'),current_date+121,'19:00',1,'cafe:arena-1',null,'partially_paid',p_payment_splits=>'[{"payment_method":"card_manual","amount":80000}]'));
select is((select payment_status from public.staff_orders where id=(select (result->>'order_id')::uuid from payment_method_results where method='mixed')),'partially_paid','Partial card payment keeps the remaining balance');
select lives_ok($q$select public.staff_record_order_payment((select (result->>'order_id')::uuid from payment_method_results where method='mixed'),'87000000-0000-4000-8000-000000000011','momo_manual',80000)$q$,'Momo can pay part of an existing balance');
select lives_ok($q$select public.staff_record_order_payment((select (result->>'order_id')::uuid from payment_method_results where method='mixed'),'87000000-0000-4000-8000-000000000012','vnpay',80000)$q$,'VNPAY can pay the final balance');
select lives_ok($q$select public.staff_record_order_payment((select (result->>'order_id')::uuid from payment_method_results where method='mixed'),'87000000-0000-4000-8000-000000000012','vnpay',80000)$q$,'Retrying a VNPAY receipt is safe');
select is((select payment_status||'/'||payment_method from public.staff_orders where id=(select (result->>'order_id')::uuid from payment_method_results where method='mixed')),'paid/split','Mixed methods reconcile the order');
select is((select count(*)::int from public.staff_order_payments where order_id=(select (result->>'order_id')::uuid from payment_method_results where method='mixed')),3,'Retry leaves exactly three receipts');
select throws_ok($q$select public.staff_record_order_payment((select (result->>'order_id')::uuid from payment_method_results where method='mixed'),'87000000-0000-4000-8000-000000000013','card_manual',1)$q$,'P0001','Payment exceeds the remaining balance. Refresh the order and check the amount.','Card receipt cannot overpay the order');
create temp table method_report as select public.staff_report_summary(current_date+121,current_date+121,current_date+121,current_date+121,1) as result;
select is((select (result#>>'{report,totalPaid}')::int from method_report),960000,'Report includes all electronic receipts beyond its one-order display limit');
select is((select (result#>>'{report,cardTotal}')::int from method_report),320000,'Report groups credit/debit card as one method');
select is((select (result#>>'{report,momoTotal}')::int from method_report),320000,'Report includes Momo total');
select is((select (result#>>'{report,vnpayTotal}')::int from method_report),320000,'Report includes VNPAY total');
select is((select (result#>>'{report,cashTotal}')::int + (result#>>'{report,bankTransferTotal}')::int from method_report),0,'Electronic methods are not classified as cash or bank transfer');
select is((select (result#>>'{comparisonReport,vnpayTotal}')::int from method_report),320000,'Comparison report includes new methods');
select is((select (result#>>'{report,unpaidAmount}')::int from method_report),0,'Fully paid mixed orders have no remaining balance');
reset role;
select * from finish();
rollback;
