-- Apply the explicit outside-hours override to the existing staff-only creation path.
-- Standard bookings still use the tariff session length and the normal capacity checks.
do $migration$
declare
  definition text;
  routine regprocedure;
  duration_guard constant text := '  if p_outside_hours and p_reserved_minutes is null then raise exception ''Outside-hours booking requires an event duration.''; end if;';
  wrapper_guard constant text := $old$  elsif p_booking->>'p_duration_minutes' is not null or coalesce((p_booking->>'p_allow_outside_hours')::boolean,false) then
    raise exception 'Custom duration and outside-hours booking require event type.';
  end if;$old$;
begin
  select p.oid::regprocedure into strict routine
  from pg_catalog.pg_proc p
  where p.pronamespace = 'private'::regnamespace and p.proname = 'create_staff_reserved_order_v3';

  definition := pg_get_functiondef(routine);
  if strpos(definition, duration_guard) > 0 then
    execute replace(definition, duration_guard || E'\n', '');
  elsif strpos(definition, 'if not p_outside_hours and') = 0
        or strpos(definition, 'Booking must finish by midnight.') = 0 then
    raise exception 'Expected staff order outside-hours logic is missing.';
  end if;

  definition := pg_get_functiondef('private.staff_create_booking(jsonb,text)'::regprocedure);
  if strpos(definition, wrapper_guard) > 0 then
    execute replace(definition, wrapper_guard, $new$  elsif p_booking->>'p_duration_minutes' is not null then
    raise exception 'Custom duration requires event type.';
  elsif coalesce((p_booking->>'p_allow_outside_hours')::boolean,false) then
    p_booking := jsonb_set(p_booking, '{p_internal_note}', to_jsonb(concat_ws(E'\n',
      nullif(p_booking->>'p_internal_note',''), 'Staff authorized booking outside opening hours.')));
  end if;$new$);
  elsif strpos(definition, 'Custom duration requires event type.') = 0 then
    raise exception 'Expected staff booking outside-hours logic is missing.';
  end if;
end
$migration$;
