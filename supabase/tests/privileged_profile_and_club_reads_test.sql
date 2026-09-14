-- Synthetic accounts and club only; no customer records are changed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users(id,email) values
 ('96000000-0000-4000-8000-000000000001','rpc-owner@example.invalid'),
 ('96000000-0000-4000-8000-000000000002','rpc-outsider@example.invalid'),
 ('96000000-0000-4000-8000-000000000003','rpc-admin@example.invalid'),
 ('96000000-0000-4000-8000-000000000004','rpc-hidden@example.invalid');
insert into public.profiles(id,email,full_name,nickname,anonymous_mode,anonymous_callsign,role) values
 ('96000000-0000-4000-8000-000000000001','rpc-owner@example.invalid','RPC Visible Name',null,false,null,'player'),
 ('96000000-0000-4000-8000-000000000002','rpc-outsider@example.invalid','RPC Outsider',null,false,null,'player'),
 ('96000000-0000-4000-8000-000000000003','rpc-admin@example.invalid','RPC Administrator',null,false,null,'admin'),
 ('96000000-0000-4000-8000-000000000004','rpc-hidden@example.invalid','RPC Hidden Identity',null,true,'RPC Masked Call Sign','player');
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
values ('96000000-0000-4000-8000-000000000005','96000000-0000-4000-8000-000000000003','totp','verified','SYNTHETIC-TEST-ONLY',now(),now());
insert into public.clubs(id,owner_id,name,visibility,pin_code)
values ('96000000-0000-4000-8000-000000000006','96000000-0000-4000-8000-000000000001','RPC private club','private','RPC96X');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000002","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.public_profile_search('RPC Hidden Identity')),0::bigint,'A hidden real name cannot identify a masked player');
select is((select count(*) from public.public_profile_search('rpc-hidden@example.invalid')),0::bigint,'A hidden email cannot identify a masked player');
select is((select count(*) from public.public_profile_search('RPC Masked Call Sign')),1::bigint,'A masked player remains discoverable by their public call sign');
select is((select full_name from public.public_profile_search('RPC Masked Call Sign')),'RPC Masked Call Sign','Search returns the public call sign');
select is((select avatar_emoji from public.public_profile_search('RPC Masked Call Sign')),'🎭','Search preserves the masked avatar');
select is((select count(*) from public.public_profile_search('rpc-owner@example.invalid')),1::bigint,'Exact email lookup still works for an unmasked player');
select is((select count(*) from public.public_profile_search('RPC Visible Name')),1::bigint,'Name lookup still works for an unmasked player');
select is((select count(*) from public.public_profile_search('R')),0::bigint,'Short searches remain empty');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000002","is_anonymous":true,"aal":"aal1"}',true);
select throws_ok($q$select public.public_profile_search('RPC')$q$,'P0001','A permanent account is required.','Anonymous Auth cannot bypass the permanent-account search restriction');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($q$select public.public_profile_search('RPC')$q$,'P0001','A permanent account is required.','Search rejects a missing account identity');

-- Each public version delegates to the same hardened club-access check.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000003","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.get_leaderboard_players_page(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'Leaderboard v1 requires MFA for administrator access to another private club');
select is((select count(*) from public.get_leaderboard_players_page_v2(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'Leaderboard v2 requires MFA for administrator access to another private club');
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'Leaderboard v3 requires MFA for administrator access to another private club');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000003","is_anonymous":false,"aal":"aal2"}',true);
select is((select count(*) from public.get_leaderboard_players_page(p_club_id=>'96000000-0000-4000-8000-000000000006')),1::bigint,'Verified administrator access works in leaderboard v1');
select is((select count(*) from public.get_leaderboard_players_page_v2(p_club_id=>'96000000-0000-4000-8000-000000000006')),1::bigint,'Verified administrator access works in leaderboard v2');
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),1::bigint,'Verified administrator access works in leaderboard v3');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000003","is_anonymous":true,"aal":"aal2"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'An anonymous Auth identity cannot use the administrator bypass');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000002","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'An unrelated player cannot list a private club');
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006',p_club_pin=>'WRONG')),0::bigint,'An incorrect PIN does not disclose club members');
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006',p_club_pin=>'RPC96X')),1::bigint,'A valid shared club PIN still grants intended read access');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),1::bigint,'The club owner retains access without staff MFA');

reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into public.club_members(club_id,profile_id,status,role)
values ('96000000-0000-4000-8000-000000000006','96000000-0000-4000-8000-000000000002','approved','member');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000002","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),2::bigint,'An approved club member retains access');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update public.club_members set deleted_at=now() where club_id='96000000-0000-4000-8000-000000000006' and profile_id='96000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000002","is_anonymous":false,"aal":"aal1"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'A deleted membership no longer grants private club access');

reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),0::bigint,'Signed-out visitors cannot read a private club without its PIN');
select throws_ok($q$select public.public_profile_search('RPC')$q$,'42501',null,'Profile search is unavailable to the signed-out database role');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update public.clubs set visibility='public' where id='96000000-0000-4000-8000-000000000006';
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*) from public.get_leaderboard_players_page_v3(p_club_id=>'96000000-0000-4000-8000-000000000006')),1::bigint,'Public club leaderboards remain available when signed out');
reset role;
select * from finish();
rollback;
