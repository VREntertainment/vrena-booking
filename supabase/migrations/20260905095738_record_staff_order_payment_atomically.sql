-- Record a receipt and its order balance in one transaction, retaining RLS and
-- named-session/MFA or authorized kiosk checks. A receipt UUID makes retries safe.
create or replace function public.staff_record_order_payment(
  p_order_id uuid, p_payment_id uuid, p_payment_method text, p_amount integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.staff_orders%rowtype;
  v_payment public.staff_order_payments%rowtype;
  v_paid bigint;
  v_methods integer;
  v_method text;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;
  if p_payment_id is null or p_payment_method is null or p_payment_method not in ('cash', 'bank_transfer') or p_amount is null or p_amount <= 0 then
    raise exception 'Enter a positive amount and a supported payment method.';
  end if;
  select * into v_order from public.staff_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  select * into v_payment from public.staff_order_payments where id = p_payment_id;
  if found then
    if v_payment.order_id <> p_order_id or v_payment.payment_method <> p_payment_method or v_payment.amount <> p_amount then
      raise exception 'This receipt reference was already used for a different payment.';
    end if;
    return jsonb_build_object('order', to_jsonb(v_order), 'payment', to_jsonb(v_payment));
  end if;
  if v_order.order_status in ('cancelled', 'refunded', 'no_show') or v_order.payment_status = 'refunded' then
    raise exception 'Payments cannot be added to this order status.';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.staff_order_payments where order_id = p_order_id;
  -- Do not silently replace historical paid flags whose receipts were not captured.
  if v_paid = 0 and v_order.payment_status in ('paid', 'partially_paid') then
    raise exception 'Review the existing payment record before adding another receipt.';
  end if;
  if v_paid + p_amount > v_order.total then
    raise exception 'Payment exceeds the remaining balance. Refresh the order and check the amount.';
  end if;
  insert into public.staff_order_payments(id, order_id, payment_method, amount, created_by)
  values (p_payment_id, p_order_id, p_payment_method, p_amount, auth.uid()) returning * into v_payment;
  select sum(amount), count(distinct payment_method), min(payment_method)
    into v_paid, v_methods, v_method from public.staff_order_payments where order_id = p_order_id;
  update public.staff_orders set
    payment_method = case when v_methods > 1 then 'split' else v_method end,
    payment_status = case when v_paid >= total then 'paid' else 'partially_paid' end,
    order_status = case when order_status = 'completed' then 'completed' when v_paid >= total then 'paid' else 'partially_paid' end,
    updated_at = now()
  where id = p_order_id returning * into v_order;
  return jsonb_build_object('order', to_jsonb(v_order), 'payment', to_jsonb(v_payment));
end;
$$;
revoke all on function public.staff_record_order_payment(uuid, uuid, text, integer) from public, anon;
grant execute on function public.staff_record_order_payment(uuid, uuid, text, integer) to authenticated;
