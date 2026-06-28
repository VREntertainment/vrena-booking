drop function if exists public.ticket_loyalty_redemption_settings(text, date);

create or replace function public.ticket_loyalty_redemption_settings(
  p_game_id text default null,
  p_booking_date date default current_date,
  p_paid_total integer default 0,
  p_player_count integer default 0
)
returns table (
  loyalty_points_total integer,
  redeem_value_vnd_per_point integer,
  estimated_points_earned integer,
  estimated_next_reduction_vnd integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking_date date := coalesce(p_booking_date, current_date);
  v_game_uuid uuid;
  v_paid_total integer := greatest(0, coalesce(p_paid_total, 0));
  v_player_count integer := greatest(0, coalesce(p_player_count, 0));
  v_points integer := 0;
  v_redeem_value integer := 0;
  v_rule record;
begin
  if v_user_id is null then
    raise exception 'Login required.';
  end if;

  select g.id
  into v_game_uuid
  from public.staff_games g
  where p_game_id is not null
    and (g.id::text = p_game_id or g.slug = p_game_id)
  limit 1;

  select coalesce(max(r.redeem_value_vnd_per_point), 0)::integer
  into v_redeem_value
  from public.staff_loyalty_rules r
  where r.active = true
    and r.redeem_value_vnd_per_point > 0
    and r.valid_from <= v_booking_date
    and (r.valid_until is null or r.valid_until >= v_booking_date)
    and (r.game_id is null or r.game_id = v_game_uuid);

  for v_rule in
    select *
    from public.staff_loyalty_rules r
    where r.active = true
      and r.earn_trigger = 'session_payment_confirmed'
      and r.valid_from <= v_booking_date
      and (r.valid_until is null or r.valid_until >= v_booking_date)
      and (r.game_id is null or r.game_id = v_game_uuid)
      and v_paid_total >= r.min_order_total
  loop
    v_points := v_points + case v_rule.calculation_type
      when 'per_vnd_spent' then floor((v_paid_total::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(v_player_count::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end;
  end loop;

  return query
  select
    coalesce(p.loyalty_points_total, 0)::integer as loyalty_points_total,
    coalesce(v_redeem_value, 0)::integer as redeem_value_vnd_per_point,
    greatest(0, coalesce(v_points, 0))::integer as estimated_points_earned,
    (greatest(0, coalesce(v_points, 0)) * coalesce(v_redeem_value, 0))::integer as estimated_next_reduction_vnd
  from public.profiles p
  where p.id = v_user_id
    and p.deleted_at is null;
end;
$$;

revoke all on function public.ticket_loyalty_redemption_settings(text, date, integer, integer) from public, anon;
grant execute on function public.ticket_loyalty_redemption_settings(text, date, integer, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
