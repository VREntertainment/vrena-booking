begin;

select set_config('request.jwt.claim.role', 'service_role', true);

update public.staff_pricing_rules
set price_per_player = 290000, updated_at = now()
where rule_name = 'Hà Đô weekend evening from Aug 31'
  and game_id is null
  and day_type = 'weekend'
  and time_start = time '20:00'
  and time_end = time '22:00'
  and active = true;

-- All customer and staff ticket calculations share this tariff helper.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.ticket_tariff_unit_price(text,text,date,time without time zone)'::regprocedure)
    into v_definition;
  if position('and p_start_time >= time ''20:00'' then 390000' in v_definition) = 0 then
    raise exception 'Expected Ha Do weekend evening tariff was not found';
  end if;
  execute replace(v_definition,
    'and p_start_time >= time ''20:00'' then 390000',
    'and p_start_time >= time ''20:00'' then 290000');
end;
$$;

commit;
