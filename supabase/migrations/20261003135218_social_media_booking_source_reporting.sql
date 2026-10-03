-- Extend source validation without replacing current booking/payment behavior.
alter table public.staff_orders drop constraint staff_orders_booking_source_check;
alter table public.staff_orders add constraint staff_orders_booking_source_check
  check (booking_source in ('walk_in','zalo','whatsapp','phone','website','social_media','other'));

do $migration$
declare
  signature text;
  definition text;
  updated text;
begin
  foreach signature in array array['private.staff_create_booking(jsonb,text)', 'private.staff_update_calendar_booking(uuid,jsonb)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    updated := replace(definition, '''walk_in'',''zalo'',''whatsapp'',''phone'',''website'',''other''', '''walk_in'',''zalo'',''whatsapp'',''phone'',''website'',''social_media'',''other''');
    if updated = definition then raise exception 'Source validation not found in %', signature; end if;
    execute updated;
  end loop;

  definition := pg_get_functiondef('public.get_staff_daily_report(date,date,date,date,integer)'::regprocedure);
  updated := replace(definition, '  return jsonb_build_object(', $patch$
  -- Aggregate all orders in each date range, independently of the detail row limit.
  select v_report || jsonb_build_object('bookingSources', coalesce(jsonb_agg(to_jsonb(s) order by s.source), '[]'::jsonb))
  into v_report
  from (
    select coalesce(booking_source, 'unspecified') as source, count(*)::integer as bookings, coalesce(sum(total),0)::bigint as sales
    from public.staff_orders where booking_date between v_start and v_end group by 1
  ) s;
  select v_comparison_report || jsonb_build_object('bookingSources', coalesce(jsonb_agg(to_jsonb(s) order by s.source), '[]'::jsonb))
  into v_comparison_report
  from (
    select coalesce(booking_source, 'unspecified') as source, count(*)::integer as bookings, coalesce(sum(total),0)::bigint as sales
    from public.staff_orders where booking_date between v_compare_start and v_compare_end group by 1
  ) s;
  return jsonb_build_object($patch$);
  if updated = definition then raise exception 'Report return not found'; end if;
  execute updated;
end;
$migration$;
