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
('QA billed slots 5-8','percentage',5,5,8,'individual','2020-01-01',true),
('QA billed slots 9-16','percentage',5,9,16,'individual','2020-01-01',true);
create temp table billing_cases(id int,guests int,arenas int,minutes int,billed int,rate numeric);
insert into billing_cases values
(1,4,1,30,4,0),(2,5,1,30,4,0),(3,8,1,30,4,0),
(4,8,1,60,4,.05),(5,8,1,90,4,.05),(6,8,1,120,4,.05),
(7,9,2,30,8,.05),(8,16,2,30,8,.05),(9,16,2,60,8,.05),
(10,16,2,90,8,0),(11,2,2,30,2,0),(12,9,1,60,4,.05);
create temp table billing_results(kind text,id int,result jsonb);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
insert into billing_results select 'guest',id,public.create_guest_ticket_booking('individual',current_date+200+id,'10:00',minutes,guests,arenas,array['laser-tag'],
public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+200+id,'10:00'),
round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+200+id,'10:00')*billed*(minutes/30)*(1-rate))::int,
'+8498800'||lpad(id::text,4,'0'),'Billing fixture') from billing_cases;
select is(s.ticket_total_price,round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',s.date,'10:00')*c.billed*(c.minutes/30)*(1-c.rate))::int,
format('Guest Ha Do: %s guests, %s arenas, %s minutes',c.guests,c.arenas,c.minutes))
from billing_results r join billing_cases c using(id) join public.sessions s on s.id=(r.result->>'session_id')::uuid where r.kind='guest';
select throws_ok($q$select public.create_guest_ticket_booking('individual',current_date+240,'10:00',30,9,1,array['laser-tag'],0,0,'+84988009991','Fixture')$q$,'P0001','Ticket duration is below the minimum for the selected players and arenas.','Ha Do requires more time for nine guests in one arena');
select throws_ok($q$select public.create_guest_ticket_booking('individual',current_date+240,'10:00',30,17,2,array['laser-tag'],0,0,'+84988009992','Fixture')$q$,'P0001','Invalid player count.','Ha Do rejects more than sixteen guests');
select throws_ok($q$select public.create_cafe_ticket_booking_request('individual',current_date+240,'16:00',30,17,1,array['revolta'],'+84988009993','Fixture')$q$,'P0001','Invalid player count.','Cafe rejects more than sixteen guests');
-- Event requests share the same hard sixteen-guest Cafe limit.
select throws_ok(format($q$select public.create_cafe_ticket_booking_request(%L,current_date+245,'16:00',30,17,1,array['revolta'],'+84988009994','Fixture')$q$,kind),
'P0001','Invalid player count.',format('Cafe rejects 17 guests for %s',kind)) from (values ('birthday'),('corporate')) t(kind);
select is((public.create_cafe_ticket_booking_request(kind,current_date+246+id,'16:00',30,16,1,array['revolta'],
'+8498811'||lpad(id::text,4,'0'),'Event fixture')->>'ticket_total_price')::int,0,format('Cafe accepts 16 guests for %s as a quote request',kind))
from (values (1,'birthday'),(2,'corporate')) t(id,kind);
-- Actual Cafe endpoint totals cover every discount boundary and multiple blocks.
select is((public.create_cafe_ticket_booking_request('individual',current_date+260+id,'16:00',minutes,guests,1,array['revolta'],
'+8498810'||lpad(id::text,4,'0'),'Cafe fixture')->>'ticket_total_price')::int,expected,
format('Cafe: %s guests, %s minutes',guests,minutes))
from (values (1,4,30,960000),(2,5,30,1140000),(3,8,30,1824000),(4,9,30,1824000),(5,16,30,1824000),
(6,16,60,3648000),(7,16,90,5760000),(8,3,90,2052000)) c(id,guests,minutes,expected);
-- Authenticated booking must quote and claim using billed slots, too.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"89000000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into billing_results select 'account',id,public.create_ticket_booking('individual',current_date+300+id,'10:00',minutes,guests,arenas,array['laser-tag'],
public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+300+id,'10:00'),
round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+300+id,'10:00')*billed*(minutes/30)*(1-rate))::int)
from billing_cases;
select is(s.ticket_total_price,round(public.ticket_tariff_unit_price('ha-do-centrosa','individual',s.date,'10:00')*c.billed*(c.minutes/30)*(1-c.rate))::int,
format('Account Ha Do: %s guests, %s arenas, %s minutes',c.guests,c.arenas,c.minutes))
from billing_results r join billing_cases c using(id) join public.sessions s on s.id=(r.result->>'session_id')::uuid where r.kind='account';
select is(s.arena_count,c.arenas,format('%s preserves the selected arena count for %s players',r.kind,c.guests)) from billing_results r join billing_cases c using(id) join public.sessions s on s.id=(r.result->>'session_id')::uuid where c.id in (11,12);
select ok(not has_function_privilege('anon','public.ticket_billed_players_per_block(text,date,integer,integer)','execute'), 'Billing helper is private to server calls');
select * from finish();
rollback;
