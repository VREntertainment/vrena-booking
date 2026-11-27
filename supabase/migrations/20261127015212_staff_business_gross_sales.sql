alter table private.staff_pos_daily_sales add column gross_sales bigint;

create or replace function public.staff_business_net_sales(p_start_date date, p_end_date date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with permitted_sales as (
    select p.sale_date, p.venue_key, p.net_sales, p.gross_sales
    from private.staff_pos_daily_sales p
    join public.staff_access_locations() l on l.venue_key = p.venue_key
  ),
  daily as (
    select * from permitted_sales
    where sale_date between p_start_date and p_end_date
  ),
  coverage as (
    select max(sale_date) as last_day
    from permitted_sales
    group by venue_key
  )
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(to_jsonb(d) order by d.sale_date, d.venue_key) from daily d), '[]'::jsonb),
    'posThrough', (select min(last_day) from coverage)
  );
$$;

revoke all on function public.staff_business_net_sales(date, date) from public, anon;
grant execute on function public.staff_business_net_sales(date, date) to authenticated, service_role;
