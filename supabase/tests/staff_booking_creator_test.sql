begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
do $test$
declare actor uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid(); fixture uuid; detail jsonb;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email) values(actor,'creator-'||actor||'@vrena.local'),(other_actor,'editor-'||other_actor||'@vrena.local');
 insert into public.profiles(id,full_name,role) values(actor,'Original PIN operator','admin'),(other_actor,'Later editor','admin') on conflict(id) do update set full_name=excluded.full_name,role='admin';
 insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values(gen_random_uuid(),actor,'totp','verified','LOCAL-TEST-ONLY',now(),now());
 update public.profiles set phone='+84901234567' where id in(actor,other_actor);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 insert into public.sessions(owner_id,name,date,start_time,duration_minutes,max_players,arena_count,game_options,game_votes,visibility,status,booking_type,ticket_type,ticket_status,venue_key)
 values(actor,'Creator fixture','2099-11-17','16:30',60,4,1,'{}','{}','private','cancelled','ticket','individual','cancelled','cafe-des-stagiaires') returning id into fixture;
 detail:=public.staff_get_booking_details(fixture);
 if detail->>'booking_creator_name' is not null then raise exception 'Invented an unrecorded creator'; end if;
 -- Simulate an expired PIN session while preserving its original HR operator.
 insert into public.audit_logs(actor_user_id,operator_session_id,action,entity_type,entity_id,new_value)
 values(other_actor,gen_random_uuid(),'kiosk_insert','sessions',fixture,jsonb_build_object('booking_operator_profile_id',actor)),
       (other_actor,gen_random_uuid(),'kiosk_update','sessions',fixture,'{}');
 detail:=public.staff_get_booking_details(fixture);
 if detail->>'booking_creator_name' is distinct from 'Original PIN operator' or (detail->>'booking_creator_via_pin')::boolean is distinct from true then raise exception 'Wrong PIN creator: %',detail; end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.staff_get_booking_details(fixture);
  raise exception 'Public access unexpectedly succeeded';
 exception when others then
  if sqlerrm<>'Staff access required.' then raise; end if;
 end;
end $test$;
select pass('Original PIN creator survives later edits, unknown history stays empty, and public access is denied');
select * from finish();
rollback;
