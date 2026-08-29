-- Apply the venue-specific 45-minute tariffs and CS opening hours from 2026-08-31.
begin;

create or replace function public.ticket_tariff_price_block_minutes(p_booking_date date)
returns integer
language sql
immutable
set search_path = public
as $$
  select case when p_booking_date < date '2026-08-31' then 20 else 45 end;
$$;

create or replace function public.ticket_tariff_unit_price(
  p_venue_key text,
  p_ticket_type text,
  p_booking_date date,
  p_start_time time without time zone
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_ticket_type <> 'individual' then 0
    when p_booking_date < date '2026-08-31' and extract(dow from p_booking_date)::integer in (0, 6) then 330000
    when p_booking_date < date '2026-08-31' and p_start_time >= time '18:00' then 250000
    when p_booking_date < date '2026-08-31' then 200000
    when p_venue_key = 'cafe-des-stagiaires' and p_start_time >= time '20:00' then 290000
    when p_venue_key = 'cafe-des-stagiaires' and extract(dow from p_booking_date)::integer in (0, 6) then 240000
    when p_venue_key = 'cafe-des-stagiaires' and p_start_time >= time '16:00' then 240000
    when p_venue_key = 'cafe-des-stagiaires' then 190000
    when extract(dow from p_booking_date)::integer in (0, 6) and p_start_time >= time '20:00' then 390000
    when extract(dow from p_booking_date)::integer in (0, 6) then 330000
    when p_start_time >= time '20:00' then 290000
    when p_start_time >= time '16:00' then 260000
    else 220000
  end;
$$;

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
      'p_duration_minutes % 20 <> 0',
      'p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0'
    );
    if v_function_definition = v_original_definition then
      raise exception 'Expected 20-minute duration validation was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      'ceil(p_player_count::numeric / (p_arena_count * 4))::integer * 20',
      'ceil(p_player_count::numeric / (p_arena_count * 4))::integer * public.ticket_tariff_price_block_minutes(p_date)'
    );
    if v_function_definition = v_original_definition then
      raise exception 'Expected 20-minute minimum duration was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      E'v_expected_unit_price := case\n    when extract(dow from p_date)::integer in (0, 6) then 330000\n    when v_start_minutes >= 18 * 60 then 250000\n    else 200000\n  end;',
      E'v_expected_unit_price := public.ticket_tariff_unit_price(\n    ''ha-do-centrosa'',\n    p_ticket_type,\n    p_date,\n    p_start_time\n  );'
    );
    v_function_definition := replace(
      v_function_definition,
      E'v_expected_unit_price := case\n    when p_ticket_type <> ''individual'' then 0\n    when extract(dow from p_date)::integer in (0, 6) then 330000\n    when v_start_minutes >= 18 * 60 then 250000\n    else 200000\n  end;',
      E'v_expected_unit_price := public.ticket_tariff_unit_price(\n    ''ha-do-centrosa'',\n    p_ticket_type,\n    p_date,\n    p_start_time\n  );'
    );
    if v_function_definition = v_original_definition then
      raise exception 'Expected legacy tariff selection was not found in %.', v_signature;
    end if;

    v_original_definition := v_function_definition;
    v_function_definition := replace(
      v_function_definition,
      'ceil(p_duration_minutes::numeric / 20)',
      'ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))'
    );
    if v_function_definition = v_original_definition then
      raise exception 'Expected 20-minute price blocks were not found in %.', v_signature;
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
    'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure;
begin
  select pg_get_functiondef(v_signature) into v_function_definition;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    'p_duration_minutes % 20 <> 0',
    'p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0'
  );
  if v_function_definition = v_original_definition then
    raise exception 'Expected Cafe 20-minute duration validation was not found.';
  end if;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    'ceil(p_player_count::numeric / (p_arena_count * 4))::integer * 20',
    'ceil(p_player_count::numeric / (p_arena_count * 4))::integer * public.ticket_tariff_price_block_minutes(p_date)'
  );
  if v_function_definition = v_original_definition then
    raise exception 'Expected Cafe 20-minute minimum duration was not found.';
  end if;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    'v_end_minutes > 24 * 60',
    'v_end_minutes > 22 * 60'
  );
  if v_function_definition = v_original_definition then
    raise exception 'Expected Cafe midnight closing validation was not found.';
  end if;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    E'v_expected_unit_price := case\n    when p_ticket_type <> ''individual'' then 0\n    when extract(dow from p_date)::integer in (0, 6) then 330000\n    when v_start_minutes >= 18 * 60 then 250000\n    else 200000\n  end;',
    E'v_expected_unit_price := public.ticket_tariff_unit_price(\n    ''cafe-des-stagiaires'',\n    p_ticket_type,\n    p_date,\n    p_start_time\n  );'
  );
  if v_function_definition = v_original_definition then
    raise exception 'Expected Cafe legacy tariff selection was not found.';
  end if;

  v_original_definition := v_function_definition;
  v_function_definition := replace(
    v_function_definition,
    'ceil(p_duration_minutes::numeric / 20)',
    'ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))'
  );
  if v_function_definition = v_original_definition then
    raise exception 'Expected Cafe 20-minute price blocks were not found.';
  end if;

  execute v_function_definition;
end;
$migration$;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.staff_pricing_rules
set valid_until = date '2026-08-30',
    updated_at = now()
where game_id is null
  and rule_name in ('Weekday day standard', 'Weekday evening standard', 'Weekend standard')
  and (valid_until is null or valid_until > date '2026-08-30');

insert into public.staff_pricing_rules (
  rule_name,
  day_type,
  time_start,
  time_end,
  price_per_player,
  valid_from,
  active
)
select tariff.*
from (values
  ('Hà Đô weekday daytime from Aug 31', 'weekday', time '09:00', time '16:00', 220000, date '2026-08-31', true),
  ('Hà Đô weekday happy hour from Aug 31', 'weekday', time '16:00', time '20:00', 260000, date '2026-08-31', true),
  ('Hà Đô weekday evening from Aug 31', 'weekday', time '20:00', time '22:00', 290000, date '2026-08-31', true),
  ('Hà Đô weekend daytime from Aug 31', 'weekend', time '09:00', time '20:00', 330000, date '2026-08-31', true),
  ('Hà Đô weekend evening from Aug 31', 'weekend', time '20:00', time '22:00', 390000, date '2026-08-31', true)
) as tariff(rule_name, day_type, time_start, time_end, price_per_player, valid_from, active)
where not exists (
  select 1
  from public.staff_pricing_rules existing
  where existing.rule_name = tariff.rule_name
    and existing.valid_from = tariff.valid_from
);

revoke all on function public.ticket_tariff_price_block_minutes(date) from public, anon, authenticated;
revoke all on function public.ticket_tariff_unit_price(text, text, date, time without time zone) from public, anon, authenticated;

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

revoke all on function public.create_cafe_ticket_booking_request(
  text, date, time without time zone, integer, integer, integer, text[], text, text, text
) from public;
grant execute on function public.create_cafe_ticket_booking_request(
  text, date, time without time zone, integer, integer, integer, text[], text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
