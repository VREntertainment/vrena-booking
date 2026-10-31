begin;
select set_config('request.jwt.claim.role', 'service_role', true);
create or replace function public.ticket_tariff_unit_price(
  p_venue_key text,
  p_ticket_type text,
  p_booking_date date,
  p_start_time time without time zone
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_ticket_type <> 'individual' then 0
    when p_booking_date < date '2026-08-31' and extract(dow from p_booking_date)::integer in (0, 6) then 330000
    when p_booking_date < date '2026-08-31' and p_start_time >= time '18:00' then 250000
    when p_booking_date < date '2026-08-31' then 200000
    when p_venue_key = 'cafe-des-stagiaires' and p_start_time >= time '20:00' then 290000
    when p_venue_key = 'cafe-des-stagiaires' and extract(dow from p_booking_date)::integer in (0, 6) then 240000
    when p_venue_key = 'cafe-des-stagiaires' and p_start_time >= time '16:00' then 240000
    when p_venue_key = 'cafe-des-stagiaires' then 190000
    when p_booking_date >= date '2026-10-31' and extract(dow from p_booking_date)::integer in (0, 6) and p_start_time >= time '20:00' then 390000
    when p_booking_date >= date '2026-10-31' and extract(dow from p_booking_date)::integer not in (0, 6) and p_start_time < time '20:00' then 260000
    when extract(dow from p_booking_date)::integer in (0, 6) and p_start_time >= time '20:00' then 290000
    when extract(dow from p_booking_date)::integer in (0, 6) then 330000
    when p_start_time >= time '20:00' then 290000
    when p_start_time >= time '16:00' then 260000
    else 220000
  end;
$$;

update public.staff_pricing_rules set valid_until=date '2026-10-30' where active and game_id is null and rule_name like 'Hà Đô % from Aug 31' and (valid_until is null or valid_until>=date '2026-10-31');
insert into public.staff_pricing_rules(rule_name,day_type,time_start,time_end,price_per_player,valid_from,active) values
('Hà Đô weekday day October menu','weekday','09:00','20:00',260000,'2026-10-31',true),
('Hà Đô weekday evening October menu','weekday','20:00','22:00',290000,'2026-10-31',true),
('Hà Đô weekend day October menu','weekend','09:00','20:00',330000,'2026-10-31',true),
('Hà Đô weekend evening October menu','weekend','20:00','22:00',390000,'2026-10-31',true);
commit;
