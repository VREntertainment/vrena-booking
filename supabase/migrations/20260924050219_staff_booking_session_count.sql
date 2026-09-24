begin;
alter table public.staff_orders add column session_count integer not null default 1 check (session_count between 1 and 32);

do $migration$
declare definition text; signature text; routine record;
begin
  for routine in select p.oid,p.proname from pg_proc p where p.pronamespace='private'::regnamespace
    and p.proname in ('create_staff_reserved_order_v2','create_staff_reserved_order_with_payments_v2')
  loop
    definition := pg_get_functiondef(routine.oid);
    signature := split_part(definition,E'\n',1);
    definition := replace(definition,signature,'CREATE OR REPLACE FUNCTION private.'||replace(routine.proname,'_v2','_v3')||'('||pg_get_function_arguments(routine.oid)||', p_session_count integer DEFAULT 1, p_standard_booking boolean DEFAULT false)');
    if routine.proname='create_staff_reserved_order_v2' then
      -- Retain existing per-game arena-slot prices; reserved session time is separate from game runtime.
      definition := replace(definition,'v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer);',
        'if not p_standard_booking then v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer); end if;');
      definition := replace(definition,'  if p_reserved_minutes is not null then',$patch$
  if p_session_count is null or p_session_count < 1 or p_session_count > 32 then raise exception 'Invalid session count.'; end if;
  if p_standard_booking then
    v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer) * p_session_count;
    v_game.duration_minutes := public.ticket_tariff_price_block_minutes(p_booking_date) * p_session_count;
  end if;
  if p_reserved_minutes is not null then$patch$);
      definition := replace(definition,'* p_players_count;', '* p_players_count * p_session_count;');
      if strpos(definition,'public.ticket_tariff_price_block_minutes(p_booking_date) * p_session_count')=0 then raise exception 'Duration guard changed.'; end if;
    else
      definition := replace(definition,'private.create_staff_reserved_order_v2(', 'private.create_staff_reserved_order_v3(');
      definition := replace(definition,'p_reserved_minutes, p_outside_hours, p_arena_count','p_reserved_minutes, p_outside_hours, p_arena_count, p_session_count, p_standard_booking');
    end if;
    execute definition;
    execute format('revoke all on function private.%I(%s,integer,boolean) from public,anon,authenticated',replace(routine.proname,'_v2','_v3'),pg_get_function_identity_arguments(routine.oid));
  end loop;
  definition := pg_get_functiondef('private.staff_create_booking(jsonb,text)'::regprocedure);
  definition := replace(definition,'  v_result := private.create_staff_reserved_order_with_payments_v2(', $patch$
  if coalesce(p_booking->>'p_session_count','1') !~ '^[0-9]+$'
    or coalesce((p_booking->>'p_session_count')::numeric,1) not between 1 and 32 then raise exception 'Invalid session count.'; end if;
  if coalesce(p_booking->>'p_booking_kind','standard')='standard' and p_booking->>'p_session_length_minutes' is not null
    and (p_booking->>'p_session_length_minutes')::numeric <> public.ticket_tariff_price_block_minutes((p_booking->>'p_booking_date')::date) then
    raise exception 'Session time has changed. Refresh the booking form before confirming.';
  end if;
  p_booking := jsonb_set(p_booking,'{p_internal_note}',to_jsonb(concat_ws(E'\n',nullif(p_booking->>'p_internal_note',''),'Sessions booked: '||coalesce(p_booking->>'p_session_count','1'))));
  v_result := private.create_staff_reserved_order_with_payments_v3($patch$);
  definition := replace(definition,$old$p_arena_count => coalesce((p_booking->>'p_arena_count')::integer,1)$old$,
    $new$p_arena_count => coalesce((p_booking->>'p_arena_count')::integer,1),
    p_session_count => coalesce((p_booking->>'p_session_count')::integer,1),
    p_standard_booking => coalesce(p_booking->>'p_booking_kind','standard')='standard'$new$);
  definition := replace(definition,'set booking_source=p_booking_source where','set booking_source=p_booking_source, session_count=coalesce((p_booking->>''p_session_count'')::integer,1) where');
  if strpos(definition,'session_count=coalesce')=0 then raise exception 'Booking metadata update changed.'; end if;
  execute definition;
end $migration$;

-- Customers may deliberately reserve either arena count. Capacity, duration, price,
-- opening-hours and overlap checks remain enforced for both signed-in and guest bookings.
do $migration$
declare routine record; definition text; original text;
begin
  for routine in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('create_ticket_booking','create_guest_ticket_booking')
  loop
    original := pg_get_functiondef(routine.oid);
    definition := replace(original,$guard$  if p_arena_count = 2 and p_player_count <= 4 then
    raise exception 'Two arenas require at least five players.';
  end if;$guard$,'');
    if definition=original then raise exception 'Expected arena-selection restriction not found.'; end if;
    if strpos(definition, 'or p_arena_count is null or p_player_count > p_arena_count * 8')=0 then raise exception 'Expected per-arena player cap not found.'; end if;
    definition := replace(definition, 'or p_arena_count is null or p_player_count > p_arena_count * 8', 'or p_arena_count is null');
    execute definition;
  end loop;
end $migration$;
notify pgrst,'reload schema';
commit;
