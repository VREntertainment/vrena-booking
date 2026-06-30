begin;

create or replace function public.claim_ticket_automatic_discount(
  p_discount_rule_id uuid,
  p_booking_date date,
  p_subtotal integer,
  p_unit_price integer,
  p_game_id text default null,
  p_player_count integer default null,
  p_start_time time default null,
  p_ticket_type text default null,
  p_customer_id uuid default null
)
returns table (
  discount_rule_id uuid,
  discount_name text,
  discount_amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discount public.staff_discount_rules%rowtype;
  v_discount_amount integer := 0;
  v_requested_price_rule_id uuid;
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
begin
  if p_discount_rule_id is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

  select *
  into v_discount
  from public.staff_discount_rules
  where id = p_discount_rule_id
    and code is null
    and active = true
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (max_uses is null or used_count < max_uses)
    and public.staff_discount_rule_matches_context(
      game_id,
      price_rule_id,
      min_players,
      max_players,
      day_scope,
      time_start,
      time_end,
      ticket_type,
      min_order_total,
      per_customer_limit,
      id,
      p_game_id,
      v_requested_price_rule_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      p_customer_id
    )
  for update;

  if not found then
    return;
  end if;

  v_discount_amount := public.staff_discount_rule_amount(
    v_discount.discount_type,
    v_discount.value,
    v_subtotal,
    p_unit_price,
    v_discount.max_discount_amount
  );

  if v_discount_amount <= 0 then
    return;
  end if;

  update public.staff_discount_rules
  set used_count = used_count + 1
  where id = v_discount.id;

  return query
  select v_discount.id, v_discount.name, v_discount_amount;
end;
$$;

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text)'::regprocedure)
  into v_definition;

  v_next_definition := replace(
    v_definition,
    'if v_discount_source = ''voucher'' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_auto_discount_rule_id is not null and v_auto_discount > 0 then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_auto_discount_rule_id;
  end if;',
    'if v_discount_source = ''voucher'' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_auto_discount_rule_id is not null and v_auto_discount > 0 then
    select claim.discount_amount
    into v_auto_discount
    from public.claim_ticket_automatic_discount(
      v_auto_discount_rule_id,
      p_date,
      v_expected_gross,
      v_expected_unit_price,
      coalesce(v_game_options[1], ''laser-tag''),
      p_player_count,
      p_start_time,
      p_ticket_type,
      v_user_id
    ) as claim
    limit 1;

    if not found or v_auto_discount is distinct from v_applied_discount then
      raise exception ''Automatic discount is no longer available for this booking.'';
    end if;
  end if;'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_ticket_booking for atomic automatic discount claiming.';
  end if;

  execute v_next_definition;
end $$;

revoke all on function public.claim_ticket_automatic_discount(uuid, date, integer, integer, text, integer, time, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_ticket_automatic_discount(uuid, date, integer, integer, text, integer, time, text, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
