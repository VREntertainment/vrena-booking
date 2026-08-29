do $$
declare
  v_signature regprocedure :=
    'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure;
  v_definition text;
begin
  select pg_get_functiondef(v_signature)
  into v_definition;

  v_definition := replace(
    v_definition,
    'Cafe des Stagiaires',
    'VRena Café des Stagiaires'
  );

  execute v_definition;
end;
$$;

comment on function public.create_cafe_ticket_booking_request(
  text,
  date,
  time without time zone,
  integer,
  integer,
  integer,
  text[],
  text,
  text,
  text
) is 'Creates a pending VRena Café des Stagiaires soft-opening ticket request that requires Zalo confirmation.';
