-- Patch the current deployed definitions without replacing newer booking rules.
do $migration$
declare
  target regprocedure;
  definition text;
  replacement text;
begin
  foreach target in array array[
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure,
    'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if position('coalesce(v_guest_name, v_customer.full_name, v_customer.nickname)' in definition) = 0 then
      raise exception 'Expected guest name response missing in %', target;
    end if;
    replacement := case when target::text like '%create_cafe_ticket_booking_request%'
      then 'case when v_user_id is null then v_guest_name else coalesce(v_guest_name, v_customer.full_name, v_customer.nickname) end'
      else 'v_guest_name' end;
    execute replace(definition, 'coalesce(v_guest_name, v_customer.full_name, v_customer.nickname)', replacement);
  end loop;
end;
$migration$;
