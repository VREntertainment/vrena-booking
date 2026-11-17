-- Run after the migration. The exception subtransaction rolls every fixture back,
-- including queued notifications, orders, reservations and audit entries.
do $test$
declare
 actor uuid; fixture uuid; created jsonb; payload jsonb; row_value public.sessions%rowtype;
 played jsonb; stamp timestamptz;
begin
 begin
  select p.id into actor from public.profiles p join auth.users u on u.id=p.id
    where p.role in ('owner','admin') and p.deleted_at is null and u.email<>'contact@vre-vietnam.com' and exists(select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified') order by p.role limit 1;
  if actor is null then raise exception 'A staff test actor is required.'; end if;
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

  -- Every category and an explicitly empty source can be saved and reloaded.
  perform public.staff_update_booking_details(fixture,payload||'{"booking_category":"event","booking_source":"whatsapp","game_changed":false}');
  select * into row_value from public.sessions where id=fixture;
  if row_value.booking_category<>'event' or row_value.booking_source<>'whatsapp' then raise exception 'Event/source persistence failed.'; end if;
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
    'p_game_id',null,'p_order_status','confirmed','p_payment_splits','[]'::jsonb),'phone');
  if not exists(select 1 from public.sessions where id=(created->>'session_id')::uuid and booking_category='birthday' and booking_source='phone' and not game_selection_explicit and confirmed_game_id is null and cardinality(game_options)=0) then raise exception 'Staff creation did not preserve category/source/empty games.'; end if;

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('request.jwt.claim.role','anon',true);
  begin
   perform public.staff_update_booking_details(fixture,payload);
   raise exception 'Anonymous metadata edit was accepted.';
  exception when others then
   if sqlerrm<>'Staff access required.' then raise; end if;
  end;
  raise exception using errcode='ZX001',message='Calendar metadata assertions passed; rolling back fixtures.';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
