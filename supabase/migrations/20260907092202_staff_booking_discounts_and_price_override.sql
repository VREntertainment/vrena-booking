begin;
alter table public.staff_orders add column price_override_original_total integer;
alter table public.staff_orders add column price_override_reason text;
alter table public.staff_orders add constraint staff_orders_price_override_check check (
  (price_override_original_total is null and price_override_reason is null) or
  (price_override_original_total is not null and price_override_original_total >= 0 and nullif(btrim(price_override_reason),'') is not null)
);

-- Keep the existing booking transaction and its permissions. The new context
-- allows staff to explicitly select the configured birthday offer.
do $migration$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('public.create_staff_order(uuid,text,text,text,uuid,date,time,integer,text,uuid,text,text,text,boolean,text,text,text,text,text,text,numeric)'::regprocedure);
  if strpos(v_definition, $old$  if p_discount_rule_id is not null then$old$) = 0
    or strpos(v_definition, $old$        'individual',
        p_customer_id$old$) = 0 then raise exception 'Staff discount validation changed unexpectedly.'; end if;
  v_definition := replace(v_definition,$old$  if p_discount_rule_id is not null then$old$,$new$  -- Staff bookings receive the best eligible configured group offer automatically.
  if p_discount_rule_id is null and v_manual_discount_type is null then
    select id into p_discount_rule_id from public.staff_discount_rules
    where active and code is null and (discount_type = 'group' or min_players > 1)
      and valid_from <= p_booking_date and (valid_until is null or valid_until >= p_booking_date)
      and (max_uses is null or used_count < max_uses)
      and public.staff_discount_rule_matches_context(
        game_id, price_rule_id, min_players, max_players, day_scope, time_start, time_end,
        ticket_type, min_order_total, per_customer_limit, id, p_game_id::text, v_rule.id,
        p_booking_date, p_booking_time, p_players_count, v_subtotal, 'individual', p_customer_id)
    order by public.staff_discount_rule_amount(discount_type,value,v_subtotal,coalesce(v_rule.price_per_player,0),max_discount_amount) desc, id
    limit 1;
  end if;

  if p_discount_rule_id is not null then$new$);
  v_definition := replace(v_definition,$old$        'individual',
        p_customer_id$old$,$new$        case when ticket_type = 'birthday' then 'birthday' else 'individual' end,
        p_customer_id$new$);
  v_definition := replace(v_definition,$old$    where id = p_discount_rule_id
      and active = true$old$,$new$    where id = p_discount_rule_id
      and coalesce(code, '') !~* '^VR_'
      and active = true$new$);
  execute v_definition;
end $migration$;

create or replace function private.staff_create_booking(p_booking jsonb, p_booking_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_override integer; v_reason text; v_paid integer; v_status text;
begin
  if auth.uid() is null or public.current_staff_role_rank() < 50 then raise exception 'Staff access required.'; end if;
  if p_booking_source is null or p_booking_source not in ('walk_in','zalo','whatsapp','phone','website','other') then raise exception 'Invalid booking source.'; end if;
  if p_booking->>'p_total_override' is not null then
    if p_booking->>'p_total_override' !~ '^[0-9]+$' or (p_booking->>'p_total_override')::numeric > 2147483647 then raise exception 'Enter a whole VND total of zero or more.'; end if;
    v_override := (p_booking->>'p_total_override')::integer;
    v_reason := nullif(btrim(p_booking->>'p_override_reason'),'');
    if v_reason is null then raise exception 'A reason is required for a price override.'; end if;
    select coalesce(sum((entry->>'amount')::integer),0) into v_paid from jsonb_array_elements(coalesce(p_booking->'p_payment_splits','[]'::jsonb)) entry;
    if v_paid > v_override then raise exception 'Payment exceeds the final total.'; end if;
    p_booking := jsonb_set(p_booking,'{p_internal_note}',to_jsonb(concat_ws(E'\n',nullif(p_booking->>'p_internal_note',''),'Price override reason: '||v_reason)));
  end if;
  v_result := public.create_staff_order_with_payments(
    p_customer_id => (p_booking->>'p_customer_id')::uuid,
    p_customer_name => p_booking->>'p_customer_name', p_customer_phone => p_booking->>'p_customer_phone', p_customer_email => p_booking->>'p_customer_email',
    p_game_id => (p_booking->>'p_game_id')::uuid, p_booking_date => (p_booking->>'p_booking_date')::date,
    p_booking_time => (p_booking->>'p_booking_time')::time, p_players_count => (p_booking->>'p_players_count')::int,
    p_arena_id => p_booking->>'p_arena_id', p_discount_rule_id => (p_booking->>'p_discount_rule_id')::uuid,
    p_order_status => p_booking->>'p_order_status', p_invoice_required => coalesce((p_booking->>'p_invoice_required')::boolean,false),
    p_company_name => p_booking->>'p_company_name', p_tax_code => p_booking->>'p_tax_code', p_invoice_email => p_booking->>'p_invoice_email',
    p_invoice_address => p_booking->>'p_invoice_address', p_internal_note => p_booking->>'p_internal_note',
    p_manual_discount_type => p_booking->>'p_manual_discount_type', p_manual_discount_value => coalesce((p_booking->>'p_manual_discount_value')::numeric,0),
    p_payment_splits => coalesce(p_booking->'p_payment_splits','[]'::jsonb)
  );
  update public.staff_orders set booking_source=p_booking_source where id=(v_result->>'order_id')::uuid;
  if v_override is not null then
    v_paid := coalesce((v_result->>'paid_total')::integer,0);
    v_status := case when v_override=0 or v_paid>=v_override then 'paid' when v_paid>0 then 'partially_paid' else 'unpaid' end;
    update public.staff_orders set total=v_override, price_override_original_total=(v_result->>'total')::integer,
      price_override_reason=v_reason, payment_status=v_status,
      order_status=case when order_status in ('paid','partially_paid') then v_status else order_status end,
      updated_at=now() where id=(v_result->>'order_id')::uuid;
    update public.sessions set ticket_total_price=v_override,updated_at=now() where id=(v_result->>'session_id')::uuid;
    v_result := v_result || jsonb_build_object('original_total',(v_result->>'total')::integer,'total',v_override,'payment_status',v_status,'price_override_reason',v_reason);
  end if;
  return v_result || jsonb_build_object('booking_source',p_booking_source);
end $$;
notify pgrst,'reload schema';
commit;
