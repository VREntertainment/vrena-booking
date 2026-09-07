begin;
-- One transaction for every split; the existing receipt operation retains RLS,
-- staff MFA, balance locking, payment-method validation and retry references.
create or replace function public.staff_record_order_payments(p_order_id uuid, p_payments jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_entry jsonb; v_result jsonb; v_payments jsonb := '[]';
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0) < 50 then raise exception 'Staff access required.'; end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then raise exception 'Enter between one and ten payment splits.'; end if;
  if jsonb_array_length(p_payments) not between 1 and 10 then raise exception 'Enter between one and ten payment splits.'; end if;
  if (select count(distinct entry->>'id') from jsonb_array_elements(p_payments) entry) <> jsonb_array_length(p_payments) then raise exception 'Each payment split needs a unique receipt reference.'; end if;
  for v_entry in select value from jsonb_array_elements(p_payments) loop
    if coalesce(v_entry->>'amount','') !~ '^[0-9]+$' then raise exception 'Enter a positive whole VND amount for every split.'; end if;
    v_result := public.staff_record_order_payment(p_order_id,(v_entry->>'id')::uuid,v_entry->>'method',(v_entry->>'amount')::integer);
    v_payments := v_payments || jsonb_build_array(v_result->'payment');
  end loop;
  return jsonb_build_object('order',v_result->'order','payments',v_payments);
end $$;
revoke all on function public.staff_record_order_payments(uuid,jsonb) from public,anon;
grant execute on function public.staff_record_order_payments(uuid,jsonb) to authenticated;

-- Lock the session before its order, matching calendar edits and deletion.
create or replace function private.staff_adjust_order_total(p_order_id uuid,p_total integer,p_reason text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.staff_orders%rowtype; v_session uuid; v_paid bigint; v_payment_status text;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0) < 50 then raise exception 'Staff access required.'; end if;
  if p_total is null or p_total < 0 then raise exception 'Enter a whole VND total of zero or more.'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required for a price adjustment.'; end if;
  if length(p_reason)>1000 then raise exception 'Keep the reason within 1000 characters.'; end if;
  select session_id into v_session from public.staff_orders where id=p_order_id;
  if v_session is not null then perform 1 from public.sessions where id=v_session for update; end if;
  select * into v_order from public.staff_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.session_id is distinct from v_session or p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then raise exception 'This order has changed. Refresh it before saving.'; end if;
  if v_order.order_status in ('cancelled','refunded','no_show','completed') or v_order.payment_status='refunded' then raise exception 'This order status cannot be repriced.'; end if;
  select coalesce(sum(amount),0) into v_paid from public.staff_order_payments where order_id=p_order_id;
  if v_paid=0 and v_order.payment_status in ('paid','partially_paid') then raise exception 'Review the existing payment record before changing the total.'; end if;
  if p_total < v_paid then raise exception 'The total cannot be lower than recorded payments.'; end if;
  v_payment_status := case when p_total=0 or v_paid>=p_total then 'paid' when v_paid>0 then 'partially_paid' else 'unpaid' end;
  update public.staff_orders set total=p_total,
    price_override_original_total=coalesce(price_override_original_total,total),price_override_reason=btrim(p_reason),
    internal_note=concat_ws(E'\n',nullif(internal_note,''),'Price adjustment '||total||' -> '||p_total||' VND: '||btrim(p_reason)),
    payment_status=v_payment_status,
    order_status=case when order_status in ('paid','partially_paid') then case when v_payment_status='unpaid' then 'confirmed' else v_payment_status end else order_status end,
    updated_at=now() where id=p_order_id returning * into v_order;
  update public.sessions set ticket_total_price=p_total,updated_at=now() where id=v_session and deleted_at is null and booking_type='ticket';
  return to_jsonb(v_order);
end $$;
create or replace function public.staff_adjust_order_total(p_order_id uuid,p_total integer,p_reason text,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path = '' as $$ select private.staff_adjust_order_total(p_order_id,p_total,p_reason,p_expected_updated_at); $$;
revoke all on function private.staff_adjust_order_total(uuid,integer,text,timestamptz), public.staff_adjust_order_total(uuid,integer,text,timestamptz) from public,anon;
grant execute on function private.staff_adjust_order_total(uuid,integer,text,timestamptz), public.staff_adjust_order_total(uuid,integer,text,timestamptz) to authenticated;

create or replace function private.staff_set_order_status(p_order_id uuid,p_status text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before public.sessions%rowtype; v_session public.sessions%rowtype; v_order public.staff_orders%rowtype; v_session_id uuid;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
  if p_status is null or p_status not in ('completed','no_show') then raise exception 'Use the booking editor to change this status.'; end if;
  select session_id into v_session_id from public.staff_orders where id=p_order_id;
  if v_session_id is not null then
    select * into v_before from public.sessions where id=v_session_id;
    perform pg_advisory_xact_lock(hashtextextended('staff_booking:'||coalesce(v_before.venue_key,'ha-do-centrosa')||':'||v_before.date::text,0));
    select * into v_session from public.sessions where id=v_session_id for update;
    if v_session.deleted_at is not null or v_session.venue_key is distinct from v_before.venue_key or v_session.date is distinct from v_before.date then raise exception 'This booking has changed. Refresh it before saving.'; end if;
  end if;
  select * into v_order from public.staff_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.session_id is distinct from v_session_id or p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then raise exception 'This order has changed. Refresh it before saving.'; end if;
  if v_order.order_status in ('cancelled','refunded','completed','no_show') and v_order.order_status<>p_status then raise exception 'This order is already closed. Review its booking before changing the status.'; end if;
  update public.sessions set status=case when p_status='completed' then 'completed' else 'cancelled' end,
    ticket_status=case when booking_type='ticket' and p_status='no_show' then 'cancelled' else ticket_status end,updated_at=now()
    where id=v_session_id;
  update public.staff_orders set order_status=p_status,updated_at=now() where id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end $$;
create or replace function public.staff_set_order_status(p_order_id uuid,p_status text,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path = '' as $$ select private.staff_set_order_status(p_order_id,p_status,p_expected_updated_at); $$;
revoke all on function private.staff_set_order_status(uuid,text,timestamptz), public.staff_set_order_status(uuid,text,timestamptz) from public,anon;
grant execute on function private.staff_set_order_status(uuid,text,timestamptz), public.staff_set_order_status(uuid,text,timestamptz) to authenticated;

-- Older open tabs must also use capacity-aware scheduling. Price changes now
-- require the reason-bearing operation above; unlinked orders have no slot to move.
create or replace function public.staff_update_order_operation(p_order_id uuid,p_game_id uuid,p_booking_date date,p_booking_time time,p_total integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.staff_orders%rowtype; v_session public.sessions%rowtype; v_slug text;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
  select * into v_order from public.staff_orders where id=p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  if p_total is distinct from v_order.total then raise exception 'Use Adjust total and enter a reason for the price change.'; end if;
  if v_order.session_id is null then raise exception 'Link this order to a calendar booking before changing its schedule.'; end if;
  select * into v_session from public.sessions where id=v_order.session_id and deleted_at is null;
  if not found then raise exception 'Booking not found.'; end if;
  select slug into v_slug from public.staff_games where id=p_game_id and active;
  if v_slug is null then raise exception 'Choose an available game.'; end if;
  perform public.staff_update_calendar_booking(v_session.id,jsonb_build_object(
    'expected_updated_at',v_session.updated_at,'name',v_session.name,'venue_key',coalesce(v_session.venue_key,'ha-do-centrosa'),
    'date',p_booking_date,'start_time',p_booking_time,'game_slug',v_slug,'players',v_order.players_count,
    'duration_minutes',v_session.duration_minutes,'arena_count',coalesce(v_session.arena_count,1),'arena_id',coalesce(v_order.arena_id,'arena-1'),
    'status',v_session.status,'notes',v_session.notes,'booking_source',v_order.booking_source));
  select * into v_order from public.staff_orders where id=p_order_id;
  return to_jsonb(v_order);
end $$;
notify pgrst,'reload schema';
commit;
