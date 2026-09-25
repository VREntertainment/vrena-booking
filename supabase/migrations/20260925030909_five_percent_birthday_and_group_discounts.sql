begin;
-- Administrative migration writes use the existing service-role trigger path.
select set_config('request.jwt.claim.role', 'service_role', true);
-- Change future offers only; recorded orders and unrelated voucher prices stay intact.
update public.staff_discount_rules
set value = 5
where discount_type in ('birthday', 'group')
   or ticket_type = 'birthday'
   or (code is null and min_players > 1);
update public.staff_discount_rules
set active = false
where discount_type in ('percentage', 'birthday', 'group', 'resident') and value = 15;

-- Preserve all validation, permissions, capacities and non-stacking behavior.
do $migration$
declare v_function record; v_definition text; v_updated text; v_count integer := 0;
begin
  for v_function in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('create_ticket_booking','create_guest_ticket_booking','create_cafe_ticket_booking_request')
      and p.prokind='f' and p.prosrc like '%0.15%'
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_updated := replace(replace(v_definition, '0.15', '0.05'), '0.10', '0.05');
    if v_updated = v_definition then raise exception 'Discount calculation not found in %', v_function.proname; end if;
    execute v_updated;
    v_count := v_count + 1;
  end loop;
  if v_count <> 3 then raise exception 'Expected three ticket pricing functions, found %', v_count; end if;

  -- Group eligibility must depend on its player range, not the former rate.
  v_count := 0;
  for v_function in
    select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('ticket_automatic_discount_quote','claim_ticket_automatic_discount') and p.prokind='f'
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_updated := replace(replace(replace(replace(v_definition,
      ' and d.value = 10', ''), ' and d.value = 15', ''),
      ' and value = 10', ''), ' and value = 15', '');
    if v_updated = v_definition then raise exception 'Group eligibility not found in %', v_function.proname; end if;
    execute v_updated;
    v_count := v_count + 1;
  end loop;
  if v_count <> 2 then raise exception 'Expected two automatic discount functions, found %', v_count; end if;
end $migration$;
commit;
