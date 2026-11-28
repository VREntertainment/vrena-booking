begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
-- Run after the migration. The exception subtransaction rolls every fixture back,
-- including queued notifications, orders, reservations and audit entries.
do $test$
declare
 actor uuid; fixture uuid; created jsonb; payload jsonb; row_value public.sessions%rowtype;
 played jsonb; stamp timestamptz;
begin
 begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  actor:=gen_random_uuid();
  insert into auth.users(id,email) values(actor,'calendar-'||actor::text||'@vrena.local');
  insert into public.profiles(id,full_name,role) values(actor,'Isolated calendar verification','admin') on conflict(id) do update set role='admin';
  insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified','LOCAL-TEST-ONLY',now(),now());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  if coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Invalid staff test actor.'; end if;

  -- A cancelled fixture has no capacity effect and deliberately has no sales order.
  insert into public.sessions(owner_id,name,date,start_time,duration_minutes,max_players,arena_count,
    game_options,game_votes,visibility,status,booking_type,ticket_type,ticket_status,venue_key)
  values(actor,'Calendar metadata verification','2099-11-17','16:30',60,4,1,'{}','{}','private','cancelled','ticket','individual','cancelled','cafe-des-stagiaires')
  returning id into fixture;
  payload:=jsonb_build_object('name','Calendar metadata verification','date','2099-11-17','start_time','16:30',
    'duration_minutes',60,'players',4,'arena_count',1,'status','cancelled','venue_key','cafe-des-stagiaires',
    'arena_id','cafe:arena-1','game_slug','','game_changed',true,'booking_category','birthday','booking_source','zalo');
  perform public.staff_update_booking_details(fixture,payload);
  select * into row_value from public.sessions where id=fixture;
  if row_value.booking_category<>'birthday' or row_value.booking_source<>'zalo' or cardinality(row_value.game_options)<>0 or row_value.confirmed_game_id is not null or row_value.game_selection_explicit then raise exception 'No-order metadata save failed.'; end if;
  if exists(select 1 from public.staff_orders where session_id=fixture) then raise exception 'Saving metadata created an order.'; end if;

  -- Human confirmation starts empty, persists independently and can be cleared.
  if (public.staff_get_booking_details(fixture)->>'client_confirmed')::boolean then raise exception 'Booking started client-confirmed.'; end if;
  perform public.staff_update_booking_details(fixture,payload||'{"client_confirmed":true}');
  if not (public.staff_get_booking_details(fixture)->>'client_confirmed')::boolean then raise exception 'Client confirmation did not persist.'; end if;
  if not exists(select 1 from private.booking_client_confirmations where session_id=fixture and confirmed_by=actor and confirmed_at is not null) then raise exception 'Confirmation actor/time missing.'; end if;
  if not exists(select 1 from public.sessions where id=fixture and status='cancelled' and ticket_status='cancelled') then raise exception 'Confirmation changed reservation status.'; end if;
  perform public.staff_update_booking_details(fixture,payload);
  if not (public.staff_get_booking_details(fixture)->>'client_confirmed')::boolean then raise exception 'Old client payload cleared confirmation.'; end if;
  begin
   perform public.staff_update_booking_details(fixture,payload||'{"client_confirmed":"true"}');
   raise exception 'Invalid confirmation was accepted.';
  exception when others then
   if sqlerrm<>'Invalid client confirmation.' then raise; end if;
  end;
  begin
   perform public.staff_update_booking_details(fixture,payload||'{"client_confirmed":false,"expected_updated_at":"2000-01-01T00:00:00Z"}');
   raise exception 'Stale confirmation edit was accepted.';
  exception when others then
   if sqlerrm<>'This booking has changed. Close and reopen it before saving.' then raise; end if;
  end;
  if not (public.staff_get_booking_details(fixture)->>'client_confirmed')::boolean then raise exception 'Stale save cleared confirmation.'; end if;
  perform public.staff_update_booking_details(fixture,payload||'{"client_confirmed":false}');
  if (public.staff_get_booking_details(fixture)->>'client_confirmed')::boolean then raise exception 'Confirmation did not clear.'; end if;

  -- Every category and an explicitly empty source can be saved and reloaded.
  perform public.staff_update_booking_details(fixture,payload||'{"booking_category":"event","booking_source":"google_maps","game_changed":false}');
  select * into row_value from public.sessions where id=fixture;
  if row_value.booking_category<>'event' or row_value.booking_source<>'google_maps' then raise exception 'Event/source persistence failed.'; end if;
  perform public.staff_update_booking_details(fixture,payload||'{"booking_category":"standard","booking_source":null,"game_changed":false}');
  if not exists(select 1 from public.sessions where id=fixture and booking_category='standard' and booking_source is null) then raise exception 'Standard/empty-source persistence failed.'; end if;

  begin
   perform public.staff_update_booking_details(fixture,payload||'{"game_slug":"laser-tag"}');
   raise exception 'Unavailable scheduled game was accepted.';
  exception when others then
   if sqlerrm<>'This game is not available at the selected shop.' then raise; end if;
  end;
  perform public.staff_update_booking_details(fixture,payload||'{"game_slug":"revolta"}');
  if not exists(select 1 from public.sessions where id=fixture and confirmed_game_id='revolta' and game_selection_explicit) then raise exception 'Manual game was not persisted.'; end if;
  update public.sessions set game_options=array['revolta','city-z'] where id=fixture;
  perform public.staff_update_booking_details(fixture,payload||'{"game_slug":"revolta","game_changed":false}');
  if not exists(select 1 from public.sessions where id=fixture and game_options=array['revolta','city-z']) then raise exception 'Metadata edit lost a manual multi-game selection.'; end if;

  begin
   perform public.staff_confirm_games_played(fixture,array['laser-tag'],null);
   raise exception 'Unavailable played game was accepted.';
  exception when others then
   if sqlerrm<>'This game is not available at the selected shop.' then raise; end if;
  end;
  played:=public.staff_confirm_games_played(fixture,array['revolta','city-z'],null);
  if jsonb_array_length(played->'game_ids')<>2 then raise exception 'Multi-game persistence failed.'; end if;
  stamp:=(played->>'updated_at')::timestamptz;
  begin
   perform public.staff_confirm_games_played(fixture,array['revolta'],null);
   raise exception 'Stale games-played edit was accepted.';
  exception when others then
   if sqlerrm<>'Games played changed. Reload before saving.' then raise; end if;
  end;
  perform public.staff_confirm_games_played(fixture,array[]::text[],stamp);

  created:=public.staff_create_booking_with_metadata(jsonb_build_object(
    'p_booking_category','birthday','p_booking_kind','event','p_duration_minutes',60,
    'p_customer_name','Calendar metadata verification','p_booking_date','2099-11-18','p_booking_time','16:30',
    'p_players_count',4,'p_arena_id','cafe:arena-1','p_arena_count',1,'p_session_count',1,
    'p_game_id',null,'p_order_status','confirmed','p_payment_splits','[]'::jsonb),'google_maps');
  if not exists(select 1 from public.sessions where id=(created->>'session_id')::uuid and booking_category='birthday' and booking_source='google_maps' and not game_selection_explicit and confirmed_game_id is null and cardinality(game_options)=0) then raise exception 'Staff creation did not preserve category/source/empty games.'; end if;

  if not (public.staff_get_booking_details((created->>'session_id')::uuid)->>'client_confirmed')::boolean then raise exception 'Staff-created confirmed booking missing contact icon.'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('request.jwt.claim.role','anon',true);
  begin
   perform public.staff_update_booking_details(fixture,payload);
   raise exception 'Anonymous metadata edit was accepted.';
  exception when others then
   if sqlerrm<>'Staff access required.' then raise; end if;
  end;
  if (private.calendar_booking_metadata(fixture)->>'client_confirmed')::boolean then raise exception 'Anonymous calendar exposed staff confirmation.'; end if;
  begin
   perform private.save_booking_client_confirmation(fixture,'{"client_confirmed":true}');
   raise exception 'Anonymous confirmation edit accepted.';
  exception when others then
   if sqlerrm<>'Staff access required.' then raise; end if;
  end;
  raise exception using errcode='ZX001',message='Calendar metadata assertions passed; rolling back fixtures.';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;

select pass('Calendar category, source, optional games and venue restrictions persist without changing payments');
select * from finish();
rollback;
