create function public.staff_resolve_booking_payment(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_booking_action text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.staff_orders%rowtype;
  v_session public.sessions%rowtype;
  v_session_id uuid;
  v_payment record;
  v_paid bigint;
  v_remaining bigint;
  v_amount integer;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_vouchers jsonb := '[]'::jsonb;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then raise exception 'Staff access required.'; end if;
  if p_action is null or p_action not in ('voucher', 'void') or p_booking_action is null
    or p_booking_action not in ('keep', 'cancel', 'delete') or (p_booking_action = 'keep' and p_action <> 'void')
    or length(v_reason) not between 3 and 1000 then raise exception 'Choose a payment action and enter a reason.'; end if;

  select session_id into v_session_id from staff_location_scope.staff_orders where id = p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  if v_session_id is not null and p_booking_action <> 'keep' then
    select * into v_session from staff_location_scope.sessions where id = v_session_id and deleted_at is null;
    if not found then raise exception 'Booking not found.'; end if;
    perform pg_advisory_xact_lock(hashtextextended('staff_booking:'||coalesce(v_session.venue_key,'ha-do-centrosa')||':'||v_session.date::text,0));
    perform 1 from staff_location_scope.sessions where id = v_session_id and date = v_session.date
      and venue_key is not distinct from v_session.venue_key and deleted_at is null for update;
    if not found then raise exception 'This booking has changed. Refresh it before saving.'; end if;
  end if;
  select * into v_order from staff_location_scope.staff_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.session_id is distinct from v_session_id or p_expected_updated_at is null
    or p_expected_updated_at is distinct from v_order.updated_at then raise exception 'This order has changed. Refresh it before saving.'; end if;
  if v_order.payment_status = 'refunded' or v_order.order_status = 'refunded' then raise exception 'This payment has already been refunded.'; end if;
  if p_booking_action <> 'keep' and v_session_id is not null and exists (
    select 1 from public.staff_orders where session_id = v_session_id and id <> v_order.id
      and order_status not in ('cancelled','refunded')
  ) then raise exception 'This booking has multiple active orders. Review them before cancelling.'; end if;

  select sum(amount) into v_paid from public.staff_order_payments where order_id = v_order.id;
  if v_paid is null and (v_order.payment_status = 'partially_paid'
    or (v_order.payment_status = 'paid' and v_order.payment_method not in ('cash','bank_transfer','card_manual','momo_manual','vnpay'))) then
    raise exception 'Reconcile this historical payment before cancelling it.';
  end if;
  if coalesce(v_paid, case when v_order.payment_status = 'paid' then v_order.total else 0 end) <= 0 then
    raise exception 'This order has no recorded payment to resolve.';
  end if;

  if p_booking_action = 'cancel' then
    perform private.staff_set_order_status(v_order.id, 'cancelled', v_order.updated_at);
  end if;

  if p_action = 'voucher' then
    if v_paid is null then
      v_vouchers := jsonb_build_array(private.convert_payment_to_voucher(v_order.id, null, gen_random_uuid(), v_order.total, v_reason, null, null));
    else
      v_remaining := v_paid;
      for v_payment in
        select p.id, p.amount
          - coalesce((select sum(v.amount) from public.payment_vouchers v where v.source_payment_id = p.id), 0)
          - coalesce((select sum(v.amount) from private.deleted_payment_vouchers v where v.source_payment_id = p.id), 0) as available_amount
        from public.staff_order_payments p where p.order_id = v_order.id and p.amount > 0
        order by p.created_at, p.id
      loop
        v_amount := least(v_remaining, greatest(0, v_payment.available_amount));
        if v_amount = 0 then continue; end if;
        v_vouchers := v_vouchers || jsonb_build_array(private.convert_payment_to_voucher(v_order.id, v_payment.id, gen_random_uuid(), v_amount, v_reason, null, null));
        v_remaining := v_remaining - v_amount;
        exit when v_remaining = 0;
      end loop;
      if v_remaining <> 0 then raise exception 'There is insufficient eligible receipt credit for the full payment.'; end if;
    end if;
  else
    if exists(select 1 from public.payment_vouchers where source_order_id = v_order.id)
      or exists(select 1 from private.deleted_payment_vouchers where source_order_id = v_order.id)
      or exists(select 1 from public.payment_voucher_redemptions where order_id = v_order.id) then
      raise exception 'This payment is linked to a voucher. Review its voucher ledger before voiding payment.';
    end if;
    -- The existing delete trigger retains the complete original receipt in audit_logs.
    delete from public.staff_order_payments where order_id = v_order.id;
    update public.staff_orders set
      payment_status = 'unpaid',
      payment_method = 'unpaid',
      order_status = case when order_status in ('paid', 'partially_paid') then 'confirmed' else order_status end,
      internal_note = concat_ws(E'\n', nullif(internal_note, ''), 'Payment voided in VRena: '||v_reason)
    where id = v_order.id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (v_actor, 'order_payment_voided', 'staff_orders', v_order.id, to_jsonb(v_order),
      jsonb_build_object('reason', v_reason, 'amount', coalesce(v_paid, v_order.total)));
  end if;

  if p_booking_action = 'delete' then
    perform public.staff_delete_session_operation(v_session_id, 'Deleted from shared booking calendar');
  end if;
  return jsonb_build_object('vouchers', v_vouchers);
end;
$$;

revoke all on function public.staff_resolve_booking_payment(uuid,timestamptz,text,text,text) from public, anon;
grant execute on function public.staff_resolve_booking_payment(uuid,timestamptz,text,text,text) to authenticated;
