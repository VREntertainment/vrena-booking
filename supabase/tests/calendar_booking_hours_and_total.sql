-- ISOLATED DATABASE ONLY: requires synthetic staff, City Z order and session fixtures.
-- Never run against production. All fixture changes are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
do $$ begin
  if exists(select 1 from private.integration_settings where key='google_sheets_webhook_url' and nullif(value,'') is not null) then raise exception 'Local test database only'; end if;
end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into auth.users(id,email) values ('88000000-0000-4000-8000-000000000071','calendar-fixture@example.invalid');
insert into public.profiles(id,full_name,role) values ('88000000-0000-4000-8000-000000000071','Calendar fixture','admin') on conflict(id) do update set role='admin';
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values ('88000000-0000-4000-8000-000000000072','88000000-0000-4000-8000-000000000071','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.sessions(id,owner_id,name,date,start_time,duration_minutes,max_players,arena_count,venue_key,confirmed_game_id,game_options)
values ('88000000-0000-4000-8000-000000000073','88000000-0000-4000-8000-000000000071','Calendar fixture',current_date+700,'16:00',60,2,1,'cafe-des-stagiaires','city-z',array['city-z']);
insert into public.staff_orders(id,order_number,session_id,game_id,booking_date,booking_time,players_count,arena_id,subtotal,total,order_status,payment_status)
values ('88000000-0000-4000-8000-000000000074','CALENDAR-FIXTURE','88000000-0000-4000-8000-000000000073',(select id from public.staff_games where slug='city-z'),current_date+700,'16:00',2,'cafe:arena-1',500000,500000,'confirmed','unpaid');
do $$
declare s public.sessions%rowtype; o public.staff_orders%rowtype; actor uuid; b jsonb; changed jsonb; paid bigint; before_payments jsonb;
begin
  select p.id into actor from public.profiles p join auth.users u on u.id=p.id
    where p.id='88000000-0000-4000-8000-000000000071' and p.deleted_at is null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
    and public.staff_role_rank(p.role,u.email)>=50 and u.email<>'contact@vre-vietnam.com'
    and exists(select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified') limit 1;
  if actor is null then raise exception 'Test requires an existing MFA-enabled staff account.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  select * into o from public.staff_orders where id='88000000-0000-4000-8000-000000000074' and order_status='confirmed' and payment_status='unpaid' and session_id is not null
    and exists(select 1 from public.sessions x where x.id=session_id and x.deleted_at is null and x.confirmed_game_id='city-z' and x.venue_key='cafe-des-stagiaires') limit 1;
  if o.id is null then raise exception 'Test requires an open City Z order.'; end if;
  select * into s from public.sessions where id=o.session_id;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into before_payments from public.staff_order_payments p where order_id=o.id;
  b := jsonb_build_object('expected_updated_at',s.updated_at,'name',s.name,'venue_key','cafe-des-stagiaires','date','2099-01-01','start_time','08:00','duration_minutes',90,'players',s.max_players,'arena_count',1,'arena_id','cafe:arena-1','status','open','game_slug','city-z','notes',s.notes,'booking_source',o.booking_source);
  begin
    perform public.staff_update_calendar_booking(s.id,b);
    raise exception 'FAIL: unchecked outside-hours save accepted';
  exception when others then if sqlerrm <> 'Selected time is outside opening hours.' then raise; end if; end;
  changed := b || jsonb_build_object('allow_outside_hours',true,'order_adjustments',jsonb_build_array(jsonb_build_object('order_id',o.id,'total',o.total+1000,'reason','Rollback verification','expected_updated_at',o.updated_at)));
  perform public.staff_update_calendar_booking(s.id,changed);
  if (select start_time from public.sessions where id=s.id) <> time '08:00' or (select total from public.staff_orders where id=o.id) <> o.total+1000 then raise exception 'FAIL: booking and total not saved'; end if;
  if (select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.staff_order_payments p where order_id=o.id) <> before_payments then raise exception 'FAIL: payment ledger changed'; end if;
  -- A failed stale-price save must also roll back its proposed time change.
  b := changed || jsonb_build_object('expected_updated_at',(select updated_at from public.sessions where id=s.id),'start_time','07:00');
  begin
    perform public.staff_update_calendar_booking(s.id,b || jsonb_build_object('order_adjustments',jsonb_build_array(jsonb_build_object('order_id',o.id,'total',o.total+2000,'reason','Rollback verification','expected_updated_at','2000-01-01T00:00:00Z'))));
    raise exception 'FAIL: stale order accepted';
  exception when others then if sqlerrm <> 'This order has changed. Refresh it before saving.' then raise; end if; end;
  if (select start_time from public.sessions where id=s.id) <> time '08:00' then raise exception 'FAIL: partial save'; end if;
  -- Before-opening and after-closing overrides work at both venues; midnight is allowed, crossing it is not.
  b := b || jsonb_build_object('order_adjustments','[]'::jsonb,'start_time','23:30','duration_minutes',30);
  perform public.staff_update_calendar_booking(s.id,b);
  b := b || jsonb_build_object('expected_updated_at',(select updated_at from public.sessions where id=s.id));
  begin
    perform public.staff_update_calendar_booking(s.id,b || '{"duration_minutes":31}'::jsonb);
    raise exception 'FAIL: next-day ending accepted';
  exception when others then if sqlerrm <> 'Booking must end on the same day.' then raise; end if; end;
  perform public.staff_update_calendar_booking(s.id,b || '{"venue_key":"ha-do-centrosa","arena_id":"arena-1","start_time":"08:00"}'::jsonb);
  select coalesce(sum(amount),0) into paid from public.staff_order_payments where order_id=o.id;
  if paid=0 then insert into public.staff_order_payments(order_id,payment_method,amount,created_by) values(o.id,'cash',100,actor); end if;
  select * into o from public.staff_orders where id=o.id;
  begin
    perform public.staff_update_calendar_booking(s.id,b || jsonb_build_object('expected_updated_at',(select updated_at from public.sessions where id=s.id),'order_adjustments',jsonb_build_array(jsonb_build_object('order_id',o.id,'total',0,'reason','Rollback verification','expected_updated_at',o.updated_at))));
    raise exception 'FAIL: total below payments accepted';
  exception when others then if sqlerrm <> 'The total cannot be lower than recorded payments.' then raise; end if; end;
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.staff_update_calendar_booking(s.id,b);
    raise exception 'FAIL: unauthenticated update accepted';
  exception when others then if sqlerrm <> 'Staff access required.' then raise; end if; end;
end $$;
select pass('Hours, both venues, midnight, atomic repricing, stale orders, payments and authorization remain protected');
select * from finish();
rollback;
