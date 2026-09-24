begin;

-- Extend the staff-only creation path without changing the public/customer RPCs.
-- Clone the current, already-hardened implementations to retain pricing and MFA checks.
do $migration$
declare definition text; signature text; target text; routine record;
begin
  for routine in select * from (values
    ('public.create_staff_order(uuid,text,text,text,uuid,date,time,integer,text,uuid,text,text,text,boolean,text,text,text,text,text,text,numeric)', 'create_staff_reserved_order'),
    ('public.create_staff_order_with_payments(uuid,text,text,text,uuid,date,time,integer,text,uuid,text,boolean,text,text,text,text,text,text,numeric,jsonb)', 'create_staff_reserved_order_with_payments')
  ) as routines(source, name)
  loop
    definition := pg_get_functiondef(routine.source::regprocedure);
    signature := split_part(definition, E'\n', 1);
    target := 'CREATE OR REPLACE FUNCTION private.' || routine.name || '(' ||
      pg_get_function_arguments(routine.source::regprocedure) || ', p_reserved_minutes integer DEFAULT NULL, p_outside_hours boolean DEFAULT false)';
    definition := replace(definition, signature, target);
    if routine.name = 'create_staff_reserved_order' then
      if strpos(definition, 'v_end_minutes := v_booking_minutes + v_game.duration_minutes;') = 0 then raise exception 'Staff duration logic changed.'; end if;
      definition := replace(definition, '  -- Keep the existing RPC signature;', $patch$
  if p_reserved_minutes is not null then
    if p_reserved_minutes < 1 or p_reserved_minutes > 1440 then raise exception 'Invalid reserved duration.'; end if;
    v_game.duration_minutes := p_reserved_minutes;
  end if;
  if p_outside_hours and p_reserved_minutes is null then raise exception 'Outside-hours booking requires an event duration.'; end if;
  if extract(hour from p_booking_time)::int * 60 + extract(minute from p_booking_time)::int + v_game.duration_minutes > 1440 then
    raise exception 'Booking must finish by midnight.';
  end if;
  -- Keep the existing RPC signature;$patch$);
      if strpos(definition, 'if v_booking_minutes < (case') = 0 then raise exception 'Staff hours guard changed.'; end if;
      definition := replace(definition,
        'if v_booking_minutes < (case when v_venue_key = ''cafe-des-stagiaires'' then 930 else 540 end) or v_end_minutes > (case when v_venue_key = ''cafe-des-stagiaires'' then 1380 else 1320 end) then',
        'if not p_outside_hours and (v_booking_minutes < (case when v_venue_key = ''cafe-des-stagiaires'' then 930 else 540 end) or v_end_minutes > (case when v_venue_key = ''cafe-des-stagiaires'' then 1380 else 1320 end)) then');
      -- Integer minute comparisons also work for reservations ending at midnight.
      definition := replace(definition, 's.start_time::time < p_booking_time + make_interval(mins => v_game.duration_minutes)',
        '(extract(hour from s.start_time::time)::int * 60 + extract(minute from s.start_time::time)::int) < v_end_minutes');
      definition := replace(definition, 'p_booking_time < s.start_time::time + make_interval(mins => s.duration_minutes)',
        'v_booking_minutes < (extract(hour from s.start_time::time)::int * 60 + extract(minute from s.start_time::time)::int + s.duration_minutes)');
    else
      if strpos(definition, E'    p_manual_discount_value\n  );') = 0 then raise exception 'Staff payment call changed.'; end if;
      definition := replace(definition, 'public.create_staff_order(', 'private.create_staff_reserved_order(');
      definition := replace(definition, E'    p_manual_discount_value\n  );', E'    p_manual_discount_value, p_reserved_minutes, p_outside_hours\n  );');
    end if;
    execute definition;
    execute format('revoke all on function private.%I(%s,integer,boolean) from public, anon, authenticated', routine.name, pg_get_function_identity_arguments(routine.source::regprocedure));
  end loop;
end $migration$;

-- Keep the existing JSON API backwards compatible and store event/contact details in
-- existing staff notes so they remain visible in order and calendar details.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('private.staff_create_booking(jsonb,text)'::regprocedure);
  definition := replace(definition, '  v_result := public.create_staff_order_with_payments(', $patch$
  if coalesce(p_booking->>'p_booking_kind','standard') not in ('standard','event') then raise exception 'Invalid booking type.'; end if;
  if length(coalesce(p_booking->>'p_contact_name','')) > 120 then raise exception 'Contact name must be 120 characters or fewer.'; end if;
  if p_booking->>'p_booking_kind' = 'event' then
    if coalesce(p_booking->>'p_duration_minutes','') !~ '^[0-9]+$' then raise exception 'Invalid reserved duration.'; end if;
    p_booking := jsonb_set(p_booking,'{p_internal_note}',to_jsonb(concat_ws(E'\n',nullif(p_booking->>'p_internal_note',''),
      'Event / corporate; reserved minutes: '||(p_booking->>'p_duration_minutes'),
      case when coalesce((p_booking->>'p_allow_outside_hours')::boolean,false) then 'Staff authorized booking outside opening hours.' end)));
  elsif p_booking->>'p_duration_minutes' is not null or coalesce((p_booking->>'p_allow_outside_hours')::boolean,false) then
    raise exception 'Custom duration and outside-hours booking require event type.';
  end if;
  if nullif(btrim(p_booking->>'p_contact_name'),'') is not null then
    p_booking := jsonb_set(p_booking,'{p_internal_note}',to_jsonb(concat_ws(E'\n',nullif(p_booking->>'p_internal_note',''),'Contact person: '||btrim(p_booking->>'p_contact_name'))));
  end if;
  v_result := private.create_staff_reserved_order_with_payments($patch$);
  if strpos(definition,'v_result := private.create_staff_reserved_order_with_payments(') = 0 then raise exception 'Staff booking wrapper changed.'; end if;
  definition := replace(definition, $old$p_payment_splits => coalesce(p_booking->'p_payment_splits','[]'::jsonb)$old$,
    $new$p_payment_splits => coalesce(p_booking->'p_payment_splits','[]'::jsonb),
    p_reserved_minutes => case when p_booking->>'p_booking_kind' = 'event' then (p_booking->>'p_duration_minutes')::integer end,
    p_outside_hours => coalesce((p_booking->>'p_allow_outside_hours')::boolean,false)$new$);
  execute definition;
end $migration$;

create or replace function private.staff_booking_availability(p_date date,p_time time,p_arena_id text,p_duration integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  venue text := case when p_arena_id='cafe:arena-1' then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;
  start_min integer := extract(hour from p_time)::int*60+extract(minute from p_time)::int;
  end_min integer := start_min+p_duration;
  used integer; blocked integer;
begin
  if auth.uid() is null or not public.is_staff_console_user(50) then raise exception 'Staff access required.'; end if;
  if p_date is null or p_time is null or p_duration is null or p_duration < 1 or end_min>1440 or p_arena_id is null then return false; end if;
  select coalesce(sum(coalesce(s.arena_count,case when s.max_players>7 then 2 else 1 end)),0) into used
  from public.sessions s where s.venue_key=venue and s.date=p_date and s.deleted_at is null and s.status='open'
    and coalesce(s.ticket_status,'') not in ('cancelled','expired')
    and extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int < end_min
    and start_min < extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int+s.duration_minutes;
  select coalesce(sum(b.arenas_used),0) into blocked from public.blocked_times b
  where venue='ha-do-centrosa' and b.date=p_date
    and extract(hour from b.start_time::time)::int*60+extract(minute from b.start_time::time)::int < end_min
    and start_min < extract(hour from b.end_time::time)::int*60+extract(minute from b.end_time::time)::int;
  if used+blocked >= (case when venue='cafe-des-stagiaires' then 1 else 2 end) then return false; end if;
  return not exists(select 1 from public.staff_orders o join public.sessions s on s.id=o.session_id
    where o.arena_id=p_arena_id and s.venue_key=venue and s.date=p_date and s.deleted_at is null and s.status='open'
      and coalesce(s.ticket_status,'') not in ('cancelled','expired')
      and extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int < end_min
      and start_min < extract(hour from s.start_time::time)::int*60+extract(minute from s.start_time::time)::int+s.duration_minutes);
end $$;
revoke all on function private.staff_booking_availability(date,time,text,integer) from public,anon;
grant execute on function private.staff_booking_availability(date,time,text,integer) to authenticated;
create or replace function public.staff_booking_availability(p_date date,p_time time,p_arena_id text,p_duration integer)
returns boolean language sql security invoker set search_path = '' as $$ select private.staff_booking_availability(p_date,p_time,p_arena_id,p_duration); $$;
revoke all on function public.staff_booking_availability(date,time,text,integer) from public,anon;
grant execute on function public.staff_booking_availability(date,time,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
