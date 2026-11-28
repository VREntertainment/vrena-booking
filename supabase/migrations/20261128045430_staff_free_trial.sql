-- Free trials use the existing staff reservation path and its arena locks.
alter table public.sessions drop constraint sessions_booking_category_check;
alter table public.sessions add constraint sessions_booking_category_check
  check (booking_category in ('standard', 'birthday', 'event', 'free_trial'));

do $migration$
declare
  definition text;
  event_note constant text := $old$'Event / corporate; reserved minutes: '||(p_booking->>'p_duration_minutes')$old$;
  duration_check constant text := 'v_duration not between 20 and 240';
begin
  definition := pg_get_functiondef('private.staff_create_booking(jsonb,text)'::regprocedure);
  if strpos(definition, event_note) = 0 then
    raise exception 'Expected staff booking duration note is missing.';
  end if;
  execute replace(definition, event_note, $new$
      (case when p_booking->>'p_booking_category' = 'free_trial' then 'Free trial; reserved minutes: '
        else 'Event / corporate; reserved minutes: ' end)||(p_booking->>'p_duration_minutes')$new$);

  definition := pg_get_functiondef('private.staff_update_booking_details(uuid,jsonb)'::regprocedure);
  if strpos(definition, duration_check) = 0 then
    raise exception 'Expected calendar duration validation is missing.';
  end if;
  execute replace(definition, duration_check, $new$
    (v_duration not between 20 and 240 and (
      v_duration not between 1 and 1440 or not exists (
        select 1 from public.sessions s
        where s.id=p_session_id and s.booking_category='free_trial' and s.deleted_at is null
          and exists(select 1 from staff_location_scope.sessions allowed where allowed.id=s.id)
      )
    ))$new$);
end
$migration$;

create or replace function public.staff_create_booking_with_metadata(p_booking jsonb, p_booking_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb;
  category text := coalesce(p_booking->>'p_booking_category', case when p_booking->>'p_booking_kind'='event' then 'event' else 'standard' end);
  v_session_id uuid;
  trial boolean := category='free_trial';
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then
    raise exception 'Staff access required.';
  end if;
  if category not in ('standard','birthday','event','free_trial') then
    raise exception 'Invalid booking category.';
  end if;

  if trial then
    -- A zero-value manual discount suppresses automatic offers without using a voucher.
    -- The existing zero-total override marks the order paid without writing a receipt.
    p_booking := p_booking || jsonb_build_object(
      'p_booking_kind', 'event',
      'p_duration_minutes', coalesce(p_booking->>'p_duration_minutes', '15'),
      'p_session_count', 1,
      'p_total_override', 0,
      'p_override_reason', 'Free trial',
      'p_discount_rule_id', null,
      'p_manual_discount_type', 'fixed_amount',
      'p_manual_discount_value', 0,
      'p_payment_splits', '[]'::jsonb
    );
  end if;

  result := public.staff_create_booking(p_booking,p_booking_source);
  v_session_id := (result->>'session_id')::uuid;
  update public.sessions set booking_category=category, booking_source=p_booking_source,
    game_selection_explicit=nullif(p_booking->>'p_game_id','') is not null,
    ticket_unit_price=case when trial then 0 else ticket_unit_price end
  where id=v_session_id and exists(select 1 from staff_location_scope.sessions allowed where allowed.id=public.sessions.id);

  if trial then
    update public.staff_orders o set subtotal=0, payment_method='free_ticket',
      price_override_original_total=null, price_override_reason=null
    where o.id=(result->>'order_id')::uuid and o.session_id=v_session_id;
    result := (result - 'original_total' - 'price_override_reason') || jsonb_build_object('subtotal', 0, 'discount_total', 0);
  end if;
  return result;
end $$;
