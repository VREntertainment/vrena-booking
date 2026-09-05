-- Local fixtures only. All writes, including catalog changes, roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into auth.users(id,email) values ('85000000-0000-4000-8000-000000000001','catalog-admin@example.invalid');
insert into public.profiles(id,full_name,role) values ('85000000-0000-4000-8000-000000000001','Catalog test admin','admin') on conflict(id) do update set role='admin';
insert into auth.users(id,email) values ('85000000-0000-4000-8000-000000000005','catalog-player@example.invalid');
insert into public.profiles(id,full_name,role) values ('85000000-0000-4000-8000-000000000005','Catalog test player','player') on conflict(id) do update set role='player';
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values ('85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000001','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.sessions(id,owner_id,name,date,start_time,max_players,game_options)
values ('85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000001','Catalog test',current_date-1,'10:00',1,array['laser-tag']);
insert into public.session_participants(session_id,profile_id,display_name,checked_in)
values ('85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000005','Catalog test player',true);
insert into public.staff_orders(id,order_number,session_id,booking_date,booking_time,players_count,total,subtotal)
values ('85000000-0000-4000-8000-000000000004','CATALOG-TEST','85000000-0000-4000-8000-000000000003',current_date-1,'10:00',1,100000,100000);

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal1"}',true);
select throws_ok($q$select public.staff_update_session_operation('85000000-0000-4000-8000-000000000003',p_confirmed_game_id=>'revolta')$q$,'P0001','Staff access required.','Catalog changes retain the staff MFA guard');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000001","is_anonymous":true,"aal":"aal2"}',true);
select throws_ok($q$select public.staff_update_session_operation('85000000-0000-4000-8000-000000000003',p_confirmed_game_id=>'revolta')$q$,'P0001','Staff access required.','Anonymous Auth cannot change recorded games');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"85000000-0000-4000-8000-000000000001","is_anonymous":false,"aal":"aal2"}',true);

-- Exercise both real staff write paths, then the report that consumes the game.
select lives_ok(format($q$select public.staff_update_session_operation('85000000-0000-4000-8000-000000000003',p_confirmed_game_id=>%L)$q$,slug),format('Staff can record %s',name)) from public.staff_games order by slug;
do $$
declare game record;
begin
  for game in select id,slug,name from public.staff_games where slug in ('revolta','city-z','station-zarya') order by slug loop
    perform public.staff_update_order_operation('85000000-0000-4000-8000-000000000004',game.id,current_date-1,'10:00',100000);
    if (select confirmed_game_id from public.sessions where id='85000000-0000-4000-8000-000000000003') is distinct from game.slug then
      raise exception 'Linked session did not record %', game.slug;
    end if;
    if not exists (
      select 1 from jsonb_array_elements(public.staff_player_behavior_report(current_date-1,current_date-1)->'gameDemand') item
      where item->>'gameKey'=game.slug and item->>'gameName'=game.name and (item->>'visits')::integer>=1
    ) then raise exception 'Game demand did not identify %',game.slug; end if;
  end loop;
end $$;
select pass('All three ANVIO order edits update linked sessions and game-demand reporting');
select throws_ok($q$select public.staff_update_session_operation('85000000-0000-4000-8000-000000000003',p_confirmed_game_id=>'unknown-game')$q$,'23503',null,'Unknown games remain rejected');
select lives_ok($q$select public.staff_update_session_operation('85000000-0000-4000-8000-000000000003',p_confirmed_game_id=>'')$q$,'Staff can clear an unconfirmed game');
select is((select confirmed_game_id from public.sessions where id='85000000-0000-4000-8000-000000000003'),null,'An unconfirmed game stays null');

insert into public.staff_games(slug,name,game_type,duration_minutes,max_players_per_arena,number_of_rounds)
values ('local-future-game','Local future game','other',45,6,1);
select lives_ok($q$select public.staff_update_session_operation('85000000-0000-4000-8000-000000000003',p_confirmed_game_id=>'local-future-game')$q$,'New catalog games work without another schema change');
update public.staff_games set slug='local-renamed-game',active=false where slug='local-future-game';
select is((select confirmed_game_id from public.sessions where id='85000000-0000-4000-8000-000000000003'),'local-renamed-game','Renaming and deactivating a game preserves its recorded identity');
reset role;
select throws_ok($q$delete from public.staff_games where slug='local-renamed-game'$q$,'23503',null,'Referenced catalog games cannot be deleted out of visit history');
select * from finish();
rollback;
