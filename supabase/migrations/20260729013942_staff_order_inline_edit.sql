begin;

create or replace function public.staff_update_order_operation(
  p_order_id uuid,
  p_game_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_total integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.staff_orders%rowtype;
  v_updated_order public.staff_orders%rowtype;
  v_game public.staff_games%rowtype;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_order_id is null then
    raise exception 'Order id is required.';
  end if;

  if p_game_id is null then
    raise exception 'Game is required.';
  end if;

  if p_booking_date is null or p_booking_time is null then
    raise exception 'Booking date and time are required.';
  end if;

  if p_total is null or p_total < 0 then
    raise exception 'Total must be zero or higher.';
  end if;

  select *
  into v_order
  from public.staff_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if p_total > 2147483647 - v_order.discount_total then
    raise exception 'Total is too large.';
  end if;

  select *
  into v_game
  from public.staff_games
  where id = p_game_id;

  if not found then
    raise exception 'Game not found.';
  end if;

  update public.staff_orders
  set game_id = v_game.id,
      booking_date = p_booking_date,
      booking_time = p_booking_time,
      subtotal = p_total + discount_total,
      total = p_total,
      updated_at = now()
  where id = p_order_id
  returning * into v_updated_order;

  if v_order.session_id is not null then
    update public.sessions
    set date = p_booking_date,
        start_time = p_booking_time,
        confirmed_game_id = v_game.slug,
        ticket_total_price = case
          when booking_type = 'ticket' then p_total
          else ticket_total_price
        end,
        updated_at = now()
    where id = v_order.session_id
      and deleted_at is null;
  end if;

  return to_jsonb(v_updated_order);
end;
$$;

revoke all on function public.staff_update_order_operation(
  uuid, uuid, date, time, integer
) from public, anon;
grant execute on function public.staff_update_order_operation(
  uuid, uuid, date, time, integer
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
