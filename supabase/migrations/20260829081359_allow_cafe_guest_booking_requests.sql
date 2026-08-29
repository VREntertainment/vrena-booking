do $$
declare
  v_signature text := 'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)';
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(to_regprocedure(v_signature))
  into v_definition;

  if v_definition is null then
    raise exception 'Required Cafe booking function not found.';
  end if;

  v_updated_definition := replace(
    v_definition,
    E'  insert into public.sessions (',
    E'  perform set_config(''app.cafe_booking_request'', ''1'', true);\n\n  insert into public.sessions ('
  );

  if v_updated_definition = v_definition then
    raise exception 'Could not add trusted Cafe request context.';
  end if;

  execute v_updated_definition;
end;
$$;

create or replace function public.rate_limit_session_creates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if (select auth.uid()) is null then
    if new.booking_type = 'ticket'
      and new.ticket_customer_id is not null
      and new.owner_id = new.ticket_customer_id
      and nullif(btrim(coalesce(new.ticket_reference, '')), '') is not null
      and new.visibility = 'private'
      and (
        new.ticket_status = 'confirmed'
        or (
          new.ticket_status = 'pending'
          and new.venue_key = 'cafe-des-stagiaires'
          and new.ticket_reference ~ '^CS-[0-9]{6}-[A-Z0-9]{6}$'
          and current_setting('app.cafe_booking_request', true) = '1'
        )
      )
    then
      return new;
    end if;

    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt',
    3,
    60,
    'session:' || coalesce(new.date::text, 'unknown-date') || ':' || coalesce(new.start_time::text, 'unknown-time')
  );

  return new;
end;
$$;
