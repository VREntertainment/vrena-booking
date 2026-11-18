begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select throws_like($$select public.staff_available_start_times(current_date,'arena-1',30,1)$$,'%Staff access required%','Availability requires staff');
do $test$
declare actor uuid:=gen_random_uuid(); slots jsonb;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email) values(actor,'availability-'||actor||'@vrena.local');
 insert into public.profiles(id,full_name,role,phone) values(actor,'Availability test','admin','+84901234567') on conflict(id) do update set role='admin';
 insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values(gen_random_uuid(),actor,'totp','verified','LOCAL-TEST-ONLY',now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 slots:=public.staff_available_start_times(current_date+51,'arena-1',30,1,'09:40');
 if not exists(select 1 from jsonb_array_elements(slots) x where x->>'time'='09:40' and (x->>'available')::boolean) then raise exception 'Custom free time missing'; end if;
 slots:=public.staff_available_start_times((now() at time zone 'Asia/Ho_Chi_Minh')::date,'arena-1',30,1,'00:00');
 if not exists(select 1 from jsonb_array_elements(slots) x where x->>'time'='00:00' and (x->>'available')::boolean and (x->>'past')::boolean) then raise exception 'Past time must remain physically available'; end if;
 slots:=public.staff_available_start_times(current_date-51,'arena-1',30,1,'09:15');
 if not exists(select 1 from jsonb_array_elements(slots) x where x->>'time'='09:15' and (x->>'available')::boolean and (x->>'past')::boolean) then raise exception 'Historical times must remain available and marked past'; end if;
 -- Make a confirmed physical reservation, without an order, as guest/public
 -- bookings can occupy an arena before staff have added a sales order.
 insert into public.sessions(owner_id,name,date,start_time,duration_minutes,max_players,arena_count,game_options,game_votes,visibility,status,booking_type,ticket_type,ticket_status,venue_key)
 values(actor,'Availability fixture',current_date+51,'09:00',70,4,2,'{}','{}','private','open','ticket','individual','confirmed','ha-do-centrosa');
 slots:=public.staff_available_start_times(current_date+51,'arena-1',30,1,'09:40');
 if exists(select 1 from jsonb_array_elements(slots) x where x->>'time' in ('09:00','09:15','09:30','09:40','09:45','10:00') and (x->>'available')::boolean) then raise exception 'Occupied slot offered'; end if;
 if not exists(select 1 from jsonb_array_elements(slots) x where x->>'time'='10:10' and (x->>'available')::boolean) then raise exception 'Adjacent free time incorrectly blocked'; end if;
end $test$;
select pass('Physical bookings block their complete interval and preserve the next free/custom times');
select * from finish();
rollback;
