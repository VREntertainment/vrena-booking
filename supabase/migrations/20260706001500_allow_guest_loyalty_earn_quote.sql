begin;

create or replace function public.ticket_loyalty_earn_quote(
  p_game_id text default null,
  p_booking_date date default current_date,
  p_paid_total integer default 0,
  p_player_count integer default 1
)
returns table (
  estimated_points integer,
  estimated_reduction_vnd integer,
  redeem_value_vnd_per_point integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paid_total integer := greatest(0, coalesce(p_paid_total, 0));
  v_player_count integer := greatest(0, coalesce(p_player_count, 0));
  v_booking_date date := coalesce(p_booking_date, current_date);
  v_points integer := 0;
  v_redeem_value integer := 0;
  v_rule record;
begin
  for v_rule in
    select *
    from public.staff_loyalty_rules
    where active = true
      and earn_trigger = 'session_payment_confirmed'
      and valid_from <= v_booking_date
      and (valid_until is null or valid_until >= v_booking_date)
      and (game_id is null or game_id = p_game_id)
      and v_paid_total >= min_order_total
  loop
    v_points := v_points + greatest(0, coalesce(case v_rule.calculation_type
      when 'per_vnd_spent' then floor((v_paid_total::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(v_player_count::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end, 0));
  end loop;

  select coalesce(max(r.redeem_value_vnd_per_point), 0)
  into v_redeem_value
  from public.staff_loyalty_rules r
  where r.active = true
    and r.redeem_value_vnd_per_point > 0
    and r.valid_from <= v_booking_date
    and (r.valid_until is null or r.valid_until >= v_booking_date)
    and (r.game_id is null or r.game_id = p_game_id);

  return query
  select
    v_points::integer,
    (v_points * coalesce(v_redeem_value, 0))::integer,
    coalesce(v_redeem_value, 0)::integer;
end;
$$;

revoke all on function public.ticket_loyalty_earn_quote(text, date, integer, integer) from public;
grant execute on function public.ticket_loyalty_earn_quote(text, date, integer, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
