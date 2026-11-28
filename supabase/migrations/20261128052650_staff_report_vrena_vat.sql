create or replace function public.staff_business_net_sales(p_start_date date, p_end_date date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with access as (
    select public.is_staff_console_user(20) as staff
  ),
  eligible_orders as (
    select o.id, o.booking_date as sale_date, o.total, o.payment_status,
           coalesce(s.venue_key, case
             when o.arena_id = 'cafe:arena-1' then 'cafe-des-stagiaires'
             when o.arena_id in ('arena-1', 'arena-2', 'sim-racing-1', 'sim-racing-2') then 'ha-do-centrosa'
             else 'other' end) as venue_key
    from staff_location_scope.staff_orders o
    left join public.sessions s on s.id = o.session_id
    where (select staff from access)
      and s.deleted_at is null
      and o.order_status not in ('draft', 'cancelled', 'refunded')
      and o.payment_status <> 'refunded'
      -- Back-entered payments belong to the booking period.
      and o.booking_date between p_start_date and p_end_date
  ),
  posted as (
    select o.sale_date, o.venue_key, p.amount
    from eligible_orders o
    join public.staff_order_payments p on p.order_id = o.id
    -- A voucher transfers an existing payment without recording a new receipt.
    where p.payment_method not in ('voucher', 'voucher_conversion')
    union all
    select o.sale_date, o.venue_key, o.total
    from eligible_orders o
    where o.payment_status = 'paid'
      and not exists (select 1 from public.staff_order_payments p where p.order_id = o.id)
  ),
  daily as (
    select p.sale_date, p.venue_key, sum(p.amount)::bigint as gross_sales
    from posted p
    group by p.sale_date, p.venue_key
  ),
  sales as (
    select d.sale_date, d.venue_key, d.gross_sales,
           -- Keep precision through aggregation. The report formats the final VND values.
           d.gross_sales::numeric / 1.08 as net_sales
    from daily d
  )
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(to_jsonb(s) order by s.sale_date, s.venue_key) from sales s), '[]'::jsonb),
    -- Kept for staff report pages loaded before the VAT calculation was deployed.
    'posThrough', case when (select staff from access) then p_end_date end
  );
$$;

revoke all on function public.staff_business_net_sales(date, date) from public, anon;
grant execute on function public.staff_business_net_sales(date, date) to authenticated, service_role;
