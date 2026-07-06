begin;

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
      and new.ticket_status = 'confirmed'
      and new.ticket_customer_id is not null
      and new.owner_id = new.ticket_customer_id
      and nullif(btrim(coalesce(new.ticket_reference, '')), '') is not null
      and new.visibility = 'private'
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

revoke all on function public.rate_limit_session_creates() from public, anon, authenticated;

do $$
declare
  v_function_definition text;
begin
  select pg_get_functiondef('public.protect_session_participant_trusted_fields()'::regprocedure)
  into v_function_definition;

  if position('and new.profile_id = v_actor' in v_function_definition) = 0 then
    raise exception 'Could not patch protect_session_participant_trusted_fields guest ticket insert allowance.';
  end if;

  v_function_definition := replace(
    v_function_definition,
    'and new.profile_id = v_actor
      and new.profile_id = v_session.ticket_customer_id',
    'and new.profile_id = v_session.ticket_customer_id
      and (
        new.profile_id = v_actor
        or (
          v_actor is null
          and v_session.owner_id = v_session.ticket_customer_id
        )
      )'
  );

  execute v_function_definition;
end $$;

revoke all on function public.protect_session_participant_trusted_fields() from public, anon, authenticated;
grant execute on function public.protect_session_participant_trusted_fields() to service_role;

notify pgrst, 'reload schema';

commit;
