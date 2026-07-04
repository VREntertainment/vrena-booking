begin;

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text)'::regprocedure)
  into v_definition;

  v_next_definition := replace(
    v_definition,
    'v_expected_unit_price := case',
    'if p_ticket_type <> ''individual'' then
    v_discount_code := null;
    v_loyalty_points_to_redeem := 0;
  end if;

  v_expected_unit_price := case'
  );

  v_next_definition := replace(
    v_next_definition,
    'if p_unit_price <> v_expected_unit_price then',
    'if p_ticket_type <> ''individual'' then
    v_expected_unit_price := 0;
  end if;

  if p_unit_price <> v_expected_unit_price then'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_ticket_booking for special ticket price confirmation.';
  end if;

  execute v_next_definition;
end $$;

notify pgrst, 'reload schema';

commit;
