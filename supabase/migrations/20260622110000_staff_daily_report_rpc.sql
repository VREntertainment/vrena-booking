create or replace function public.get_staff_daily_report(
  p_start_date date,
  p_end_date date,
  p_compare_start date default null,
  p_compare_end date default null,
  p_order_limit integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_compare_start date := case
    when p_compare_start is null or p_compare_end is null then null
    else least(p_compare_start, p_compare_end)
  end;
  v_compare_end date := case
    when p_compare_start is null or p_compare_end is null then null
    else greatest(p_compare_start, p_compare_end)
  end;
  v_order_limit integer := least(greatest(coalesce(p_order_limit, 120), 0), 250);
  v_report jsonb;
  v_comparison_report jsonb;
  v_report_series jsonb;
  v_comparison_series jsonb;
  v_orders jsonb;
  v_payments jsonb;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with payment_totals as (
    select
      order_id,
      count(*)::integer as payment_count,
      coalesce(sum(amount), 0)::bigint as total_paid,
      coalesce(sum(amount) filter (where payment_method = 'cash'), 0)::bigint as cash_total,
      coalesce(sum(amount) filter (where payment_method = 'bank_transfer'), 0)::bigint as bank_transfer_total
    from public.staff_order_payments
    group by order_id
  ),
  scoped_orders as (
    select
      o.*,
      coalesce(p.payment_count, 0) as payment_count,
      coalesce(p.total_paid, 0) as split_paid_total,
      coalesce(p.cash_total, 0) as split_cash_total,
      coalesce(p.bank_transfer_total, 0) as split_bank_transfer_total
    from public.staff_orders o
    left join payment_totals p on p.order_id = o.id
    where o.booking_date between v_start and v_end
  ),
  totals as (
    select
      coalesce(sum(total), 0)::bigint as total_sales,
      coalesce(sum(case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end), 0)::bigint as total_paid,
      coalesce(sum(greatest(0, total - case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end)), 0)::bigint as unpaid_amount,
      coalesce(sum(case when payment_count > 0 then split_cash_total when payment_method = 'cash' then total else 0 end), 0)::bigint as cash_total,
      coalesce(sum(case when payment_count > 0 then split_bank_transfer_total when payment_method = 'bank_transfer' then total else 0 end), 0)::bigint as bank_transfer_total,
      count(*)::integer as bookings,
      coalesce(sum(players_count), 0)::integer as players,
      count(*) filter (where order_status = 'cancelled')::integer as cancelled,
      count(*) filter (where order_status = 'no_show')::integer as no_shows,
      coalesce(sum(discount_total), 0)::bigint as discounts
    from scoped_orders
  ),
  best_game as (
    select coalesce((
      select coalesce(g.name, 'Unknown')
      from scoped_orders so
      left join public.staff_games g on g.id = so.game_id
      group by coalesce(g.name, 'Unknown')
      order by count(*) desc, coalesce(g.name, 'Unknown') asc
      limit 1
    ), 'None yet') as best_selling_game
  )
  select jsonb_build_object(
    'totalSales', total_sales,
    'totalPaid', total_paid,
    'unpaidAmount', unpaid_amount,
    'cashTotal', cash_total,
    'bankTransferTotal', bank_transfer_total,
    'bookings', bookings,
    'players', players,
    'cancelled', cancelled,
    'noShows', no_shows,
    'discounts', discounts,
    'bestSellingGame', best_selling_game
  )
  into v_report
  from totals
  cross join best_game;

  with days as (
    select generate_series(v_start, least(v_end, v_start + 44), interval '1 day')::date as day
  ),
  daily as (
    select
      booking_date,
      coalesce(sum(total), 0)::bigint as sales,
      count(*)::integer as bookings,
      coalesce(sum(players_count), 0)::integer as players
    from public.staff_orders
    where booking_date between v_start and least(v_end, v_start + 44)
    group by booking_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', days.day::text,
    'sales', coalesce(daily.sales, 0),
    'bookings', coalesce(daily.bookings, 0),
    'players', coalesce(daily.players, 0)
  ) order by days.day), '[]'::jsonb)
  into v_report_series
  from days
  left join daily on daily.booking_date = days.day;

  if v_compare_start is null or v_compare_end is null then
    v_comparison_report := jsonb_build_object(
      'totalSales', 0,
      'totalPaid', 0,
      'unpaidAmount', 0,
      'cashTotal', 0,
      'bankTransferTotal', 0,
      'bookings', 0,
      'players', 0,
      'cancelled', 0,
      'noShows', 0,
      'discounts', 0,
      'bestSellingGame', 'None yet'
    );
    v_comparison_series := '[]'::jsonb;
  else
    with payment_totals as (
      select
        order_id,
        count(*)::integer as payment_count,
        coalesce(sum(amount), 0)::bigint as total_paid,
        coalesce(sum(amount) filter (where payment_method = 'cash'), 0)::bigint as cash_total,
        coalesce(sum(amount) filter (where payment_method = 'bank_transfer'), 0)::bigint as bank_transfer_total
      from public.staff_order_payments
      group by order_id
    ),
    scoped_orders as (
      select
        o.*,
        coalesce(p.payment_count, 0) as payment_count,
        coalesce(p.total_paid, 0) as split_paid_total,
        coalesce(p.cash_total, 0) as split_cash_total,
        coalesce(p.bank_transfer_total, 0) as split_bank_transfer_total
      from public.staff_orders o
      left join payment_totals p on p.order_id = o.id
      where o.booking_date between v_compare_start and v_compare_end
    ),
    totals as (
      select
        coalesce(sum(total), 0)::bigint as total_sales,
        coalesce(sum(case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end), 0)::bigint as total_paid,
        coalesce(sum(greatest(0, total - case when payment_count > 0 then split_paid_total when payment_status = 'paid' then total else 0 end)), 0)::bigint as unpaid_amount,
        coalesce(sum(case when payment_count > 0 then split_cash_total when payment_method = 'cash' then total else 0 end), 0)::bigint as cash_total,
        coalesce(sum(case when payment_count > 0 then split_bank_transfer_total when payment_method = 'bank_transfer' then total else 0 end), 0)::bigint as bank_transfer_total,
        count(*)::integer as bookings,
        coalesce(sum(players_count), 0)::integer as players,
        count(*) filter (where order_status = 'cancelled')::integer as cancelled,
        count(*) filter (where order_status = 'no_show')::integer as no_shows,
        coalesce(sum(discount_total), 0)::bigint as discounts
      from scoped_orders
    ),
    best_game as (
      select coalesce((
        select coalesce(g.name, 'Unknown')
        from scoped_orders so
        left join public.staff_games g on g.id = so.game_id
        group by coalesce(g.name, 'Unknown')
        order by count(*) desc, coalesce(g.name, 'Unknown') asc
        limit 1
      ), 'None yet') as best_selling_game
    )
    select jsonb_build_object(
      'totalSales', total_sales,
      'totalPaid', total_paid,
      'unpaidAmount', unpaid_amount,
      'cashTotal', cash_total,
      'bankTransferTotal', bank_transfer_total,
      'bookings', bookings,
      'players', players,
      'cancelled', cancelled,
      'noShows', no_shows,
      'discounts', discounts,
      'bestSellingGame', best_selling_game
    )
    into v_comparison_report
    from totals
    cross join best_game;

    with days as (
      select generate_series(v_compare_start, least(v_compare_end, v_compare_start + 44), interval '1 day')::date as day
    ),
    daily as (
      select
        booking_date,
        coalesce(sum(total), 0)::bigint as sales,
        count(*)::integer as bookings,
        coalesce(sum(players_count), 0)::integer as players
      from public.staff_orders
      where booking_date between v_compare_start and least(v_compare_end, v_compare_start + 44)
      group by booking_date
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', days.day::text,
      'sales', coalesce(daily.sales, 0),
      'bookings', coalesce(daily.bookings, 0),
      'players', coalesce(daily.players, 0)
    ) order by days.day), '[]'::jsonb)
    into v_comparison_series
    from days
    left join daily on daily.booking_date = days.day;
  end if;

  with selected_orders as (
    select *
    from public.staff_orders
    where booking_date between v_start and v_end
    order by booking_date desc, booking_time desc
    limit v_order_limit
  )
  select coalesce(jsonb_agg(to_jsonb(so) order by so.booking_date desc, so.booking_time desc), '[]'::jsonb)
  into v_orders
  from selected_orders so;

  with selected_orders as (
    select id
    from public.staff_orders
    where booking_date between v_start and v_end
    order by booking_date desc, booking_time desc
    limit v_order_limit
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb)
  into v_payments
  from public.staff_order_payments p
  where p.order_id in (select id from selected_orders);

  return jsonb_build_object(
    'report', coalesce(v_report, '{}'::jsonb),
    'comparisonReport', coalesce(v_comparison_report, '{}'::jsonb),
    'reportSeries', coalesce(v_report_series, '[]'::jsonb),
    'comparisonSeries', coalesce(v_comparison_series, '[]'::jsonb),
    'orders', coalesce(v_orders, '[]'::jsonb),
    'payments', coalesce(v_payments, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_staff_daily_report(date, date, date, date, integer) to authenticated;
