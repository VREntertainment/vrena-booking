CREATE OR REPLACE FUNCTION private.staff_set_order_status(p_order_id uuid, p_status text, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_before public.sessions%rowtype; v_session public.sessions%rowtype; v_order public.staff_orders%rowtype; v_session_id uuid;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
  if p_status is null or p_status not in ('completed','no_show','cancelled') then raise exception 'Use the booking editor to change this status.'; end if;
  select session_id into v_session_id from staff_location_scope.staff_orders where id=p_order_id;
  if v_session_id is not null then
    select * into v_before from staff_location_scope.sessions where id=v_session_id;
    perform pg_advisory_xact_lock(hashtextextended('staff_booking:'||coalesce(v_before.venue_key,'ha-do-centrosa')||':'||v_before.date::text,0));
    select * into v_session from staff_location_scope.sessions where id=v_session_id for update;
    if not found or v_session.deleted_at is not null or v_session.venue_key is distinct from v_before.venue_key or v_session.date is distinct from v_before.date then raise exception 'This booking has changed. Refresh it before saving.'; end if;
  end if;
  select * into v_order from staff_location_scope.staff_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.session_id is distinct from v_session_id or p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then raise exception 'This order has changed. Refresh it before saving.'; end if;
  if v_order.order_status in ('cancelled','refunded','completed','no_show') and v_order.order_status<>p_status then raise exception 'This order is already closed. Review its booking before changing the status.'; end if;
  update public.sessions set status=case when p_status='completed' then 'completed' else 'cancelled' end,
    ticket_status=case when booking_type='ticket' and p_status in ('no_show','cancelled') then 'cancelled' else ticket_status end,updated_at=now()
    where id=v_session_id;
  update public.staff_orders set order_status=p_status,updated_at=now() where id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end $function$;
