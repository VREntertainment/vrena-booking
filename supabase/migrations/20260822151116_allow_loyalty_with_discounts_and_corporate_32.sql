-- Keep loyalty redemption additive to ticket discounts and expand corporate capacity.
begin;

alter table public.sessions
  drop constraint sessions_max_players_check;

alter table public.sessions
  add constraint sessions_max_players_check
  check (
    max_players >= 1
    and (
      max_players <= 16
      or (
        max_players <= 32
        and coalesce(booking_type = 'ticket' and ticket_type = 'corporate', false)
      )
    )
  );

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure,
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_function_definition;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'  if p_player_count < 1 or p_player_count > 16 then\n    raise exception ''Invalid player count.'';\n  end if;',
      E'  if p_player_count < 1\n    or (p_ticket_type = ''corporate'' and p_player_count > 32)\n    or (p_ticket_type <> ''corporate'' and p_player_count > 16)\n  then\n    raise exception ''Invalid player count.'';\n  end if;'
    );

    if v_function_definition = v_original_definition then
      raise exception 'Expected 16-player validation was not found in %.', v_signature;
    end if;

    execute v_function_definition;
  end loop;
end;
$migration$;

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
  v_signature constant regprocedure :=
    'public.protect_profile_sensitive_fields()'::regprocedure;
begin
  select pg_get_functiondef(v_signature) into v_function_definition;
  v_original_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    E'  if v_is_service_role then\n    return new;\n  end if;',
    E'  if v_is_service_role\n    or coalesce(current_setting(''app.loyalty_internal_update'', true), '''') = ''allowed''\n  then\n    return new;\n  end if;'
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected protected profile service-role guard was not found in %.', v_signature;
  end if;

  execute v_function_definition;
end;
$migration$;

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
  v_signature constant regprocedure :=
    'public.apply_loyalty_points_delta(uuid,integer,uuid,text,uuid,text,uuid)'::regprocedure;
begin
  select pg_get_functiondef(v_signature) into v_function_definition;
  v_original_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    E'      from public.loyalty_point_transactions\n      where profile_id = p_profile_id\n        and source_type = p_source_type\n        and source_id = p_source_id\n        and rule_id is not distinct from p_rule_id',
    E'      from public.loyalty_point_transactions as transaction\n      where transaction.profile_id = p_profile_id\n        and transaction.source_type = p_source_type\n        and transaction.source_id = p_source_id\n        and transaction.rule_id is not distinct from p_rule_id'
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected ambiguous loyalty transaction lookup was not found in %.', v_signature;
  end if;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    E'  v_current integer;\n  v_next integer;',
    E'  v_current integer;\n  v_next integer;\n  v_previous_internal_update text;'
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected loyalty balance declarations were not found in %.', v_signature;
  end if;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    E'  update public.profiles\n  set loyalty_points_total = v_next,\n      updated_at = now()\n  where id = p_profile_id;',
    E'  v_previous_internal_update := current_setting(''app.loyalty_internal_update'', true);\n  perform set_config(''app.loyalty_internal_update'', ''allowed'', true);\n\n  update public.profiles\n  set loyalty_points_total = v_next,\n      updated_at = now()\n  where id = p_profile_id;\n\n  perform set_config(\n    ''app.loyalty_internal_update'',\n    coalesce(v_previous_internal_update, ''''),\n    true\n  );'
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected loyalty balance update was not found in %.', v_signature;
  end if;

  execute v_function_definition;
end;
$migration$;

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
  v_signature constant regprocedure :=
    'public.protect_profile_loyalty_points_total()'::regprocedure;
begin
  select pg_get_functiondef(v_signature) into v_function_definition;
  v_original_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    E'  if old.loyalty_points_total is distinct from new.loyalty_points_total\n    and current_user <> ''service_role''\n    and not public.is_staff_console_user(50)',
    E'  if old.loyalty_points_total is distinct from new.loyalty_points_total\n    and coalesce(current_setting(''app.loyalty_internal_update'', true), '''') <> ''allowed''\n    and current_user <> ''service_role''\n    and not public.is_staff_console_user(50)'
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected loyalty balance protection condition was not found in %.', v_signature;
  end if;

  execute v_function_definition;
end;
$migration$;

do $migration$
declare
  v_function_definition text;
  v_original_definition text;
  v_signature constant regprocedure :=
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure;
begin
  select pg_get_functiondef(v_signature) into v_function_definition;
  v_original_definition := v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    E'\n    if v_loyalty_points_to_redeem > 0 then\n      raise exception ''Loyalty points cannot be used together with voucher or discount codes. The best price reduction is used automatically.'';\n    end if;',
    ''
  );

  if v_function_definition = v_original_definition then
    raise exception 'Expected voucher and loyalty exclusion was not found in %.', v_signature;
  end if;

  execute v_function_definition;
end;
$migration$;

revoke all on function public.create_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, integer, text, text
) from public, anon;
grant execute on function public.create_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, integer, text, text
) to authenticated;

revoke all on function public.create_guest_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, text, text, text
) from public;
grant execute on function public.create_guest_ticket_booking(
  text, date, time without time zone, integer, integer, integer, text[], integer, integer, text, text, text
) to anon, authenticated;

revoke all on function public.apply_loyalty_points_delta(
  uuid, integer, uuid, text, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.apply_loyalty_points_delta(
  uuid, integer, uuid, text, uuid, text, uuid
) to service_role;

revoke all on function public.protect_profile_loyalty_points_total()
from public, anon, authenticated;
grant execute on function public.protect_profile_loyalty_points_total()
to service_role;

revoke all on function public.protect_profile_sensitive_fields()
from public, anon, authenticated;
grant execute on function public.protect_profile_sensitive_fields()
to service_role;

notify pgrst, 'reload schema';

commit;
