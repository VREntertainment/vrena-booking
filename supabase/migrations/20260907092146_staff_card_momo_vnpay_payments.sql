begin;

-- These are staff-recorded receipts. Existing historical card/Momo identifiers
-- stay intact, and credit/debit cards remain one method.
alter table public.staff_order_payments drop constraint staff_order_payments_payment_method_check;
alter table public.staff_order_payments add constraint staff_order_payments_payment_method_check
  check (payment_method in ('cash', 'bank_transfer', 'card_manual', 'momo_manual', 'vnpay'));
alter table public.staff_orders drop constraint staff_orders_payment_method_check;
alter table public.staff_orders add constraint staff_orders_payment_method_check
  check (payment_method in ('cash', 'bank_transfer', 'split', 'momo_manual', 'card_manual', 'vnpay', 'voucher', 'free_ticket', 'unpaid'));

-- Patch only the allowlists, retaining current authorization, RLS, concurrency,
-- retry protection, prices and the atomic booking/receipt logic.
do $migration$
declare v_definition text; v_patch record;
begin
  for v_patch in select * from (values
    ('public.create_staff_order(uuid,text,text,text,uuid,date,time without time zone,integer,text,uuid,text,text,text,boolean,text,text,text,text,text,text,numeric)', $old$p_payment_method not in ('cash', 'bank_transfer', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid')$old$, $new$p_payment_method not in ('cash', 'bank_transfer', 'momo_manual', 'card_manual', 'vnpay', 'voucher', 'free_ticket', 'unpaid')$new$),
    ('public.create_staff_order_with_payments(uuid,text,text,text,uuid,date,time without time zone,integer,text,uuid,text,boolean,text,text,text,text,text,text,numeric,jsonb)', $old$v_split.payment_method not in ('cash', 'bank_transfer')$old$, $new$v_split.payment_method is null or v_split.payment_method not in ('cash', 'bank_transfer', 'card_manual', 'momo_manual', 'vnpay')$new$),
    ('public.staff_record_order_payment(uuid,uuid,text,integer)', $old$p_payment_method not in ('cash', 'bank_transfer')$old$, $new$p_payment_method not in ('cash', 'bank_transfer', 'card_manual', 'momo_manual', 'vnpay')$new$)
  ) as patches(signature, old_text, new_text)
  loop
    v_definition := pg_get_functiondef(v_patch.signature::regprocedure);
    if strpos(v_definition, v_patch.old_text) = 0 then
      raise exception 'Payment validation changed unexpectedly in %', v_patch.signature;
    end if;
    execute replace(v_definition, v_patch.old_text, v_patch.new_text);
  end loop;
end $migration$;

-- Include the new methods in both current and comparison report totals.
CREATE OR REPLACE FUNCTION public.get_staff_daily_report(p_start_date date, p_end_date date, p_compare_start date DEFAULT NULL::date, p_compare_end date DEFAULT NULL::date, p_order_limit integer DEFAULT 120)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      coalesce(sum(amount) filter (where payment_method = 'bank_transfer'), 0)::bigint as bank_transfer_total,
      coalesce(sum(amount) filter (where payment_method = 'card_manual'), 0)::bigint as card_total,
      coalesce(sum(amount) filter (where payment_method = 'momo_manual'), 0)::bigint as momo_total,
      coalesce(sum(amount) filter (where payment_method = 'vnpay'), 0)::bigint as vnpay_total
    from public.staff_order_payments
    group by order_id
  ),
  scoped_orders as (
    select
      o.*,
      coalesce(p.payment_count, 0) as payment_count,
      coalesce(p.total_paid, 0) as split_paid_total,
      coalesce(p.cash_total, 0) as split_cash_total,
      coalesce(p.bank_transfer_total, 0) as split_bank_transfer_total,
      coalesce(p.card_total, 0) as split_card_total,
      coalesce(p.momo_total, 0) as split_momo_total,
      coalesce(p.vnpay_total, 0) as split_vnpay_total
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
      coalesce(sum(case when payment_count > 0 then split_card_total when payment_method = 'card_manual' and payment_status = 'paid' then total else 0 end), 0)::bigint as card_total,
      coalesce(sum(case when payment_count > 0 then split_momo_total when payment_method = 'momo_manual' and payment_status = 'paid' then total else 0 end), 0)::bigint as momo_total,
      coalesce(sum(case when payment_count > 0 then split_vnpay_total when payment_method = 'vnpay' and payment_status = 'paid' then total else 0 end), 0)::bigint as vnpay_total,
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
    'cardTotal', card_total,
    'momoTotal', momo_total,
    'vnpayTotal', vnpay_total,
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
      'cardTotal', 0,
      'momoTotal', 0,
      'vnpayTotal', 0,
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
        coalesce(sum(amount) filter (where payment_method = 'bank_transfer'), 0)::bigint as bank_transfer_total,
      coalesce(sum(amount) filter (where payment_method = 'card_manual'), 0)::bigint as card_total,
      coalesce(sum(amount) filter (where payment_method = 'momo_manual'), 0)::bigint as momo_total,
      coalesce(sum(amount) filter (where payment_method = 'vnpay'), 0)::bigint as vnpay_total
      from public.staff_order_payments
      group by order_id
    ),
    scoped_orders as (
      select
        o.*,
        coalesce(p.payment_count, 0) as payment_count,
        coalesce(p.total_paid, 0) as split_paid_total,
        coalesce(p.cash_total, 0) as split_cash_total,
        coalesce(p.bank_transfer_total, 0) as split_bank_transfer_total,
      coalesce(p.card_total, 0) as split_card_total,
      coalesce(p.momo_total, 0) as split_momo_total,
      coalesce(p.vnpay_total, 0) as split_vnpay_total
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
      coalesce(sum(case when payment_count > 0 then split_card_total when payment_method = 'card_manual' and payment_status = 'paid' then total else 0 end), 0)::bigint as card_total,
      coalesce(sum(case when payment_count > 0 then split_momo_total when payment_method = 'momo_manual' and payment_status = 'paid' then total else 0 end), 0)::bigint as momo_total,
      coalesce(sum(case when payment_count > 0 then split_vnpay_total when payment_method = 'vnpay' and payment_status = 'paid' then total else 0 end), 0)::bigint as vnpay_total,
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
    'cardTotal', card_total,
    'momoTotal', momo_total,
    'vnpayTotal', vnpay_total,
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
$function$
;
notify pgrst, 'reload schema';
commit;
