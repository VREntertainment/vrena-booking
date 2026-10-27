begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values
 ('97000000-0000-4000-8000-000000000001','session-owner@example.invalid'),
 ('97000000-0000-4000-8000-000000000002','session-participant@example.invalid'),
 ('97000000-0000-4000-8000-000000000003','session-other-voter@example.invalid'),
 ('97000000-0000-4000-8000-000000000004','session-admin@example.invalid');
insert into public.profiles(id,full_name,role,phone)
select id,'Session security fixture',case when id='97000000-0000-4000-8000-000000000004' then 'admin' else 'player' end,'+999' || right(id::text,8)
from auth.users where id::text like '97000000%' on conflict(id) do update set role=excluded.role,phone=excluded.phone;
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
values(gen_random_uuid(),'97000000-0000-4000-8000-000000000004','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.staff_discount_rules(id,name,code,discount_type,value)
values('97000000-0000-4000-8000-000000000010','Security fixture','SECURITY-FIXTURE','percentage',10);
insert into public.sessions(id,owner_id,name,date,start_time,max_players,game_options,game_votes,booking_type,ticket_type,ticket_status,ticket_customer_id,ticket_discount_rule_id,ticket_discount_code)
values('97000000-0000-4000-8000-000000000020','97000000-0000-4000-8000-000000000001','Ticket security fixture',current_date+1200,'16:00',4,array['laser-tag'],
 '{"97000000-0000-4000-8000-000000000001":"laser-tag","97000000-0000-4000-8000-000000000003":"laser-tag"}',
 'ticket','individual','confirmed','97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000010','SECURITY-FIXTURE');
insert into public.sessions(id,owner_id,name,date,start_time,max_players,game_options,game_votes)
values('97000000-0000-4000-8000-000000000021','97000000-0000-4000-8000-000000000001','Community security fixture',current_date+1200,'18:00',4,array['laser-tag'],
 '{"97000000-0000-4000-8000-000000000003":"laser-tag"}');
insert into public.session_participants(session_id,profile_id,display_name)
select s,'97000000-0000-4000-8000-000000000002','Participant'
from unnest(array['97000000-0000-4000-8000-000000000020'::uuid,'97000000-0000-4000-8000-000000000021'::uuid]) s;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
select throws_ok($q$update public.sessions set venue_key='cafe-des-stagiaires' where id='97000000-0000-4000-8000-000000000020'$q$,'P0001',null,'Ticket owner cannot move a paid reservation to another venue');
select throws_ok($q$update public.sessions set ticket_discount_rule_id=null where id='97000000-0000-4000-8000-000000000020'$q$,'P0001',null,'Ticket owner cannot erase voucher-redemption history');
select throws_ok($q$update public.sessions set ticket_discount_code=null where id='97000000-0000-4000-8000-000000000020'$q$,'P0001',null,'Ticket owner cannot change voucher metadata');
select lives_ok($q$update public.sessions set name='Owner can rename' where id='97000000-0000-4000-8000-000000000020'$q$,'Existing owner non-operational editing is preserved');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000002","is_anonymous":false}',true);
select lives_ok($q$update public.sessions set game_votes=game_votes || jsonb_build_object(auth.uid()::text,'laser-tag') where id='97000000-0000-4000-8000-000000000020'$q$,'Participant can add their own vote');
select lives_ok($q$update public.sessions set game_votes=game_votes - auth.uid()::text where id='97000000-0000-4000-8000-000000000020'$q$,'Participant can remove their own vote');
select throws_ok($q$update public.sessions set game_votes=game_votes || jsonb_build_object(auth.uid()::text,'laser-tag'),venue_key='cafe-des-stagiaires' where id='97000000-0000-4000-8000-000000000020'$q$,'P0001',null,'Vote update cannot carry a ticket venue change');
select throws_ok($q$update public.sessions set game_votes=game_votes || jsonb_build_object(auth.uid()::text,'laser-tag'),game_options=array['city-z'] where id='97000000-0000-4000-8000-000000000021'$q$,'P0001',null,'Vote update cannot carry an omitted community-session field');
select throws_ok($q$update public.sessions set game_votes=game_votes || jsonb_build_object('97000000-0000-4000-8000-000000000003','city-z') where id='97000000-0000-4000-8000-000000000021'$q$,'P0001',null,'Participant cannot replace another player vote');
select throws_ok($q$update public.sessions set game_votes='{}'::jsonb where id='97000000-0000-4000-8000-000000000021'$q$,'P0001',null,'Participant cannot delete other player votes');
select throws_ok($q$update public.sessions set game_votes='[]'::jsonb where id='97000000-0000-4000-8000-000000000021'$q$,'P0001',null,'Participant votes must remain an object');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select lives_ok($q$update public.sessions set venue_key='cafe-des-stagiaires' where id='97000000-0000-4000-8000-000000000020'$q$,'Authorized staff can move the reservation');
reset role;
select is((select venue_key from private.arena_reservations where session_id='97000000-0000-4000-8000-000000000020'),'cafe-des-stagiaires','Authorized venue change still updates atomic allocation');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($q$update public.sessions set ticket_discount_code='SERVICE-EDIT' where id='97000000-0000-4000-8000-000000000020'$q$,'Service writes remain permitted');
-- The private claim RPC creates this exact transaction-bound capability before
-- its definer UPDATE. Exercise the same trigger path without bypassing guards.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"97000000-0000-4000-8000-000000000002","is_anonymous":false}',true);
insert into private.guest_ticket_claim_context(transaction_id,session_id,actor_id,previous_owner_id,guest_profile_id,expected_game_votes)
select pg_current_xact_id(),id,'97000000-0000-4000-8000-000000000002',owner_id,ticket_customer_id,
 (game_votes-owner_id::text) || jsonb_build_object('97000000-0000-4000-8000-000000000002','laser-tag')
from public.sessions where id='97000000-0000-4000-8000-000000000020';
select lives_ok($q$update public.sessions set owner_id=auth.uid(),ticket_customer_id=auth.uid(),game_votes=(game_votes-owner_id::text) || jsonb_build_object(auth.uid()::text,'laser-tag') where id='97000000-0000-4000-8000-000000000020'$q$,'Exact transaction-authorized guest ownership claim still passes');
select * from finish();
rollback;
