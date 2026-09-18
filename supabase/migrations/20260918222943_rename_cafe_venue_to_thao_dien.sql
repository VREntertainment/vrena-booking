-- Change display text only; preserve venue keys, ticket references, and booking rules.
do $$
declare
  v_signature regprocedure := 'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure;
  v_definition text;
begin
  select pg_get_functiondef(v_signature) into v_definition;
  v_definition := replace(v_definition, 'VRena Café des Stagiaires', 'Vrena Thao Dien');
  execute v_definition;
end;
$$;
comment on function public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)
is 'Creates a pending Vrena Thao Dien soft-opening ticket request that requires Zalo confirmation.';
