-- Local fixtures only; all configuration changes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select set_config('request.jwt.claim.role', 'service_role', true);
select plan(9);

update public.staff_loyalty_rules set active = false where active;
insert into public.staff_loyalty_rules
  (rule_name, calculation_type, points_value, min_order_total, valid_from, active)
values ('Loyalty rate regression', 'per_vnd_spent', 1, 0, current_date - 1, true);

select is((select spend_amount from public.staff_loyalty_rules where active), 50000,
  'New rules default to one point per 50,000 VND');
select is((select redeem_value_vnd_per_point from public.staff_loyalty_rules where active), 2500,
  'New rules default to 2,500 VND per point');

select is((select estimated_points from public.ticket_loyalty_earn_quote(null, current_date, paid, 1)), expected,
  format('%s VND earns %s whole points', paid, expected))
from (values (0,0),(49999,0),(50000,1),(99999,1),(100000,2)) cases(paid,expected);

select is((select estimated_reduction_vnd from public.ticket_loyalty_earn_quote(null, current_date, 100000, 1)), 5000,
  'Two earned points are worth 5,000 VND on the next booking');
select is((select redeem_value_vnd_per_point from public.ticket_loyalty_earn_quote(null, current_date, 50000, 1)), 2500,
  'Public booking quote exposes the current redemption value');

select * from finish();
rollback;
