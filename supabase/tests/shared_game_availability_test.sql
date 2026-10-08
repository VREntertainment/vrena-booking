begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values('96000000-0000-4000-8000-000000000001','shared-games-admin@example.invalid');
insert into public.profiles(id,full_name,role) values('96000000-0000-4000-8000-000000000001','Shared games test admin','admin') on conflict(id) do update set role='admin';
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values('96000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','totp','verified','LOCAL-TEST-ONLY',now(),now());
select is((select count(*)::int from public.staff_games where slug in ('birthday-party','portal-zombie','arcade-2-0','party-games','portal-mafia','orc-kings-arena','vr-arena-strike') and active and max_players_per_arena=6),7,'All seven shared games are active');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select lives_ok(format(
  $test$select public.staff_create_booking(jsonb_build_object('p_game_id',%L::uuid,'p_booking_date',current_date+%s,'p_booking_time','16:00','p_players_count',%s,'p_arena_id',%L,'p_order_status','confirmed'),'walk_in')$test$,
  id, 320 + row_number() over(order by slug,arena),players,arena),
  format('%s can be booked for %s players in %s',name,players,arena))
from public.staff_games cross join (values ('arena-1',4),('cafe:arena-1',6)) venues(arena,players)
where slug in ('birthday-party','portal-zombie','arcade-2-0','party-games','portal-mafia','orc-kings-arena','vr-arena-strike');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"96000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select throws_ok($test$select public.staff_create_booking('{}','walk_in')$test$,'P0001','Staff access required.','The expanded catalog retains the staff MFA guard');
select * from finish();
rollback;
