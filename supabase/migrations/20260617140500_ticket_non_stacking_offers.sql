-- Enforce one offer/voucher per ticket booking.
-- Birthday discount and group discount must not stack; the best available offer wins.

do $$
declare
  v_function_definition text;
begin
  select pg_get_functiondef(
    'public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer)'::regprocedure
  )
  into v_function_definition;

  if v_function_definition is null then
    raise exception 'create_ticket_booking function was not found.';
  end if;

  if position('v_discount_rate := v_discount_rate + 0.10;' in v_function_definition) = 0 then
    raise exception 'Expected stacking birthday discount rule was not found.';
  end if;

  v_function_definition := replace(
    v_function_definition,
    'v_discount_rate := v_discount_rate + 0.10;',
    'v_discount_rate := greatest(v_discount_rate, 0.10);'
  );

  execute v_function_definition;
end;
$$;

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) from public, anon;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) to authenticated;
