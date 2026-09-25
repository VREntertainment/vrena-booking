create or replace function public.ticket_tariff_price_block_minutes(p_booking_date date)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_booking_date < date '2026-08-31' then 20
    when p_booking_date < date '2026-09-25' then 45
    else 30
  end;
$$;

revoke all on function public.ticket_tariff_price_block_minutes(date) from public, anon, authenticated;
