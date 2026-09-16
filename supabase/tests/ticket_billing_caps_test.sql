begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
do $$ begin
  if exists (select 1 from private.integration_settings where key='google_sheets_webhook_url' and nullif(value,'') is not null) then
    raise exception 'Local test database only';
  end if;
end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values ('89000000-0000-4000-8000-000000000001','billing-cap@example.invalid');
insert into public.profiles(id,full_name) values ('89000000-0000-4000-8000-000000000001','Billing cap test') on conflict(id) do nothing;
update public.staff_discount_rules set active=false;
insert into public.staff_discount_rules(name,discount_type,value,min_players,max_players,ticket_type,valid_from,active) values
('QA billed slots 5-8','percentage',10,5,8,'individual','2020-01-01',true),
('QA billed slots 9-16','percentage',15,9,16,'individual','2020-01-01',true);
create temp table billing_cases(id int,guests int,arenas int,minutes int,billed int,rate numeric);
insert into billing_cases values
(1,4,1,45,4,0),(2,5,1,45,4,0),(3,8,1,45,4,0),
(4,8,1,90,4,.10),(5,8,1,135,4,.15),(6,8,1,180,4,.15),
(7,9,2,45,8,.10),(8,16,2,45,8,.10),(9,16,2,90,8,.15),
(10,16,2,135,8,0);
create temp table billing_results(kind text,id int,result jsonb);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
insert into billing_results select 'guest',id,public.create_guest_ticket_booking('individual',current_date+200+id,'10:00',minutes,guests,arenas,array['laser-tag'],
public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+200+id,'10:00'),
round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+200+id,'10:00')*billed*(minutes/45)*(1-rate))::int,
'+8498800'||lpad(id::text,4,'0'),'Billing fixture') from billing_cases;
select is(s.ticket_total_price,round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',s.date,'10:00')*c.billed*(c.minutes/45)*(1-c.rate))::int,
format('Guest Ha Do: %s guests, %s arenas, %s minutes',c.guests,c.arenas,c.minutes))
from billing_results r join billing_cases c using(id) join public.sessions s on s.id=(r.result->>'session_id')::uuid where r.kind='guest';
select throws_ok($q$select public.create_guest_ticket_booking('individual',current_date+240,'10:00',45,9,1,array['laser-tag'],0,0,'+84988009991','Fixture')$q$,'P0001','Invalid player count.','Ha Do rejects nine guests in one arena');
select throws_ok($q$select public.create_guest_ticket_booking('individual',current_date+240,'10:00',45,17,2,array['laser-tag'],0,0,'+84988009992','Fixture')$q$,'P0001','Invalid player count.','Ha Do rejects more than sixteen guests');
select throws_ok($q$select public.create_cafe_ticket_booking_request('individual',current_date+240,'16:00',45,17,1,array['revolta'],'+84988009993','Fixture')$q$,'P0001','Invalid player count.','Cafe rejects more than sixteen guests');
-- Actual Cafe endpoint totals cover every discount boundary and multiple blocks.
select is((public.create_cafe_ticket_booking_request('individual',current_date+260+id,'16:00',minutes,guests,1,array['revolta'],
'+8498810'||lpad(id::text,4,'0'),'Cafe fixture')->>'ticket_total_price')::int,expected,
format('Cafe: %s guests, %s minutes',guests,minutes))
from (values (1,4,45,960000),(2,5,45,1080000),(3,8,45,1728000),(4,9,45,1728000),(5,16,45,1728000),
(6,16,90,3264000),(7,16,135,5760000),(8,3,135,1836000)) c(id,guests,minutes,expected);
-- Authenticated booking must quote and claim using billed slots, too.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"89000000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into billing_results select 'account',id,public.create_ticket_booking('individual',current_date+300+id,'10:00',minutes,guests,arenas,array['laser-tag'],
public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+300+id,'10:00'),
round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+300+id,'10:00')*billed*(minutes/45)*(1-rate))::int)
from billing_cases;
select is(s.ticket_total_price,round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',s.date,'10:00')*c.billed*(c.minutes/45)*(1-c.rate))::int,
format('Account Ha Do: %s guests, %s arenas, %s minutes',c.guests,c.arenas,c.minutes))
from billing_results r join billing_cases c using(id) join public.sessions s on s.id=(r.result->>'session_id')::uuid where r.kind='account';
select ok(not has_function_privilege('anon','public.ticket_billed_players_per_block(text,date,integer,integer)','execute'), 'Billing helper is private to server calls');
select * from finish();
rollback;
