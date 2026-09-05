begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into auth.users (id, email) values
 ('83000000-0000-4000-8000-000000000001', 'advisory-owner@example.invalid'),
 ('83000000-0000-4000-8000-000000000002', 'advisory-player@example.invalid'),
 ('83000000-0000-4000-8000-000000000003', 'advisory-admin@example.invalid'),
 ('83000000-0000-4000-8000-000000000004', 'contact@vre-vietnam.com'),
 ('83000000-0000-4000-8000-000000000005', 'advisory-operator@example.invalid');
insert into public.profiles (id, full_name, role)
select id, 'Advisory ' || right(id::text, 1), case when right(id::text, 1)='3' then 'admin' else 'player' end
from auth.users where id::text like '83000000-%'
on conflict (id) do update set role=excluded.role;
insert into auth.mfa_factors (id,user_id,factor_type,status,secret,created_at,updated_at)
values ('83000000-0000-4000-8000-000000000099','83000000-0000-4000-8000-000000000003','totp','verified','LOCAL-TEST-ONLY',now(),now());

insert into public.sessions (id,owner_id,name,date,start_time,max_players,visibility,booking_type)
values
 ('83000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000001','Private advisory fixture',current_date+70,'10:00',4,'private','community'),
 ('83000000-0000-4000-8000-000000000012','83000000-0000-4000-8000-000000000001','Public advisory fixture',current_date+70,'11:00',4,'public','community');
insert into public.session_messages (id,session_id,author_id,author_display_name,body,moderation_status)
values
 ('83000000-0000-4000-8000-000000000021','83000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000001','Owner','Private approved fixture','approved'),
 ('83000000-0000-4000-8000-000000000022','83000000-0000-4000-8000-000000000012','83000000-0000-4000-8000-000000000001','Owner','Public approved fixture','approved');
insert into public.tournament_editors (session_id,profile_id,display_name)
values ('83000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000001','Private editor');
insert into public.tournament_teams (id,session_id,name,created_by)
values ('83000000-0000-4000-8000-000000000031','83000000-0000-4000-8000-000000000011','Private team','83000000-0000-4000-8000-000000000001');
insert into public.session_participants (id,session_id,profile_id,display_name)
values ('83000000-0000-4000-8000-000000000032','83000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000001','Private owner');
insert into public.tournament_team_members (team_id,participant_id,profile_id)
values ('83000000-0000-4000-8000-000000000031','83000000-0000-4000-8000-000000000032','83000000-0000-4000-8000-000000000001');
insert into public.clubs (id,owner_id,name,visibility)
values ('83000000-0000-4000-8000-000000000041','83000000-0000-4000-8000-000000000001','Advisory public club','public');
insert into public.staff_employee_profiles (profile_id,legal_name,employment_type,active)
values ('83000000-0000-4000-8000-000000000005','Advisory operator','part_time',true);
insert into private.staff_kiosk_pin_credentials (profile_id,pin_hash,access_role)
values ('83000000-0000-4000-8000-000000000005','local-test-fixture','manager');
insert into private.staff_kiosk_operator_sessions (auth_user_id,operator_profile_id,access_role,token_hash)
values ('83000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000005','manager',encode(extensions.digest('local-advisory-station-token','sha256'),'hex'));

select ok(not exists (
 select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind='r'
 and has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
), 'anonymous browser roles have no direct table writes or truncate grants');
select ok(not exists (
 select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind='r'
 and has_table_privilege('authenticated',c.oid,'TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
), 'authenticated browsers have no table administration privileges');

-- Prevent the performance regressions that the advisor identified. These
-- inspect operations separately so an ALL policy cannot hide an overlap.
select ok(not exists (
 select 1 from pg_policies p
 cross join lateral unnest(p.roles) r(role_name)
 cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) a(action)
 where p.schemaname in ('public','private') and p.permissive='PERMISSIVE'
 and p.cmd in ('ALL',a.action)
 group by p.schemaname,p.tablename,r.role_name,a.action having count(*)>1
), 'application policies have no overlapping permissive role and operation');
select ok(not exists (
 select 1 from pg_policies p
 cross join lateral (values (p.qual),(p.with_check)) e(expression)
 where p.schemaname in ('public','private')
 and regexp_replace(e.expression,'SELECT auth[.](uid|jwt|email|role)[(][)]','','gi') ~ 'auth[.](uid|jwt|email|role)[(][)]'
), 'request-constant Auth policy calls are evaluated through an initplan');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.session_messages where id='83000000-0000-4000-8000-000000000021'),0::bigint,'approved messages in private sessions stay private');
select is((select count(*) from public.session_messages where id='83000000-0000-4000-8000-000000000022'),1::bigint,'signed-in players still read approved public-session messages');
select is((select count(*) from public.tournament_editors where session_id='83000000-0000-4000-8000-000000000011'),0::bigint,'private tournament editor identities are hidden from unrelated players');
select is((select count(*) from public.tournament_teams where id='83000000-0000-4000-8000-000000000031'),0::bigint,'private tournament teams are hidden from unrelated players');
select is((select count(*) from public.tournament_team_members where team_id='83000000-0000-4000-8000-000000000031'),0::bigint,'private team members are hidden from unrelated players');
select throws_ok($$insert into public.club_members (club_id,profile_id,status,role) values ('83000000-0000-4000-8000-000000000041','83000000-0000-4000-8000-000000000002','approved','admin')$$,'42501',null,'joining a public club cannot grant the new member admin rights');
select throws_ok($$insert into public.club_members (club_id,profile_id,status,role) values ('83000000-0000-4000-8000-000000000041','83000000-0000-4000-8000-000000000002','approved','owner')$$,'42501',null,'joining a public club cannot forge an owner membership');
select lives_ok($$insert into public.club_members (club_id,profile_id,status,role) values ('83000000-0000-4000-8000-000000000041','83000000-0000-4000-8000-000000000002','approved','member')$$,'a player can still join a public club as a member');
select results_eq($$update public.club_members set role='admin' where club_id='83000000-0000-4000-8000-000000000041' and profile_id='83000000-0000-4000-8000-000000000002' returning role$$,$$select null::text where false$$,'a member cannot promote their own club role');

select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.session_messages where id='83000000-0000-4000-8000-000000000021'),1::bigint,'the session owner retains private-message access');
select is((select count(*) from public.tournament_editors where session_id='83000000-0000-4000-8000-000000000011'),1::bigint,'the session owner retains private tournament access');
select lives_ok($$update public.club_members set role='admin' where club_id='83000000-0000-4000-8000-000000000041' and profile_id='83000000-0000-4000-8000-000000000002'$$,'the club owner can manage member roles');
select is((select role from public.club_members where club_id='83000000-0000-4000-8000-000000000041' and profile_id='83000000-0000-4000-8000-000000000002'),'admin','the authorized club-role change is saved');

select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false,"aal":"aal1"}',true);
select is(public.current_staff_role_rank(),0,'a named admin without MFA has no staff rank');
select throws_ok($$select public.staff_report_summary(current_date,current_date)$$,null,null,'the invoker report wrapper still rejects an admin without MFA');
select throws_ok($$select public.staff_save_player_achievement_profile('83000000-0000-4000-8000-000000000002',0,'{}','{}','[]',null)$$,null,null,'the invoker achievement wrapper retains its authorization check');
select is((select count(*) from public.staff_employee_profiles where profile_id='83000000-0000-4000-8000-000000000005'),0::bigint,'an admin without MFA cannot read another employee HR record');
select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false,"aal":"aal2"}',true);
select is(public.current_staff_role_rank(),100,'an admin with a verified factor and AAL2 retains staff rank');
select lives_ok($$select public.staff_report_summary(current_date,current_date)$$,'the invoker report wrapper works for an MFA-verified admin');
select is((select count(*) from public.staff_employee_profiles where profile_id='83000000-0000-4000-8000-000000000005'),1::bigint,'an MFA-verified admin retains HR access');
select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true,"aal":"aal2"}',true);
select is(public.current_staff_role_rank(),0,'anonymous Auth claims cannot acquire staff privileges');
select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000002","role":"authenticated","email":"emilejacquet@icloud.com","is_anonymous":false,"aal":"aal2"}',true);
select is(public.current_staff_role_rank(),0,'a stale privileged email claim cannot override current account state');

select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000004","role":"authenticated","email":"contact@vre-vietnam.com","is_anonymous":false,"aal":"aal1"}',true);
select set_config('request.headers','{}',true);
select is(public.current_staff_role_rank(),0,'the shared kiosk account has no access while locked');
select set_config('request.headers','{"x-vrena-operator-session":"local-advisory-station-token"}',true);
select is(public.current_staff_role_rank(),80,'a valid independent kiosk PIN session retains its manager rank');
select is(public.current_staff_actor_profile_id(),'83000000-0000-4000-8000-000000000005'::uuid,'kiosk actions remain attributed to the operator');
select is((select count(*) from public.staff_employee_profiles where profile_id='83000000-0000-4000-8000-000000000005'),1::bigint,'the operator retains their own employee record');
select set_config('request.headers','{"x-vrena-operator-session":"incorrect-station-token"}',true);
select is(public.current_staff_role_rank(),0,'an incorrect kiosk token cannot inherit another station permissions');

reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select lives_ok($$select count(*) from public.get_leaderboard_players()$$,'the invoker leaderboard wrapper remains available to public visitors');
reset role;
select * from finish();
rollback;
