begin;

-- Use the existing administrative path for configuration-write triggers.
select set_config('request.jwt.claim.role', 'service_role', true);

alter table public.staff_loyalty_rules
  alter column spend_amount set default 50000,
  alter column redeem_value_vnd_per_point set default 2500;

-- Preserve balances, transaction history, expiry, eligibility and payment timing.
update public.staff_loyalty_rules
set calculation_type = 'per_vnd_spent',
    points_value = 1,
    spend_amount = 50000,
    redeem_value_vnd_per_point = 2500,
    updated_at = now()
where active = true;

commit;
