begin;

create or replace function public.consume_guest_ticket_booking_rate_limit(
  p_guest_phone text,
  p_date date,
  p_start_time time,
  p_ticket_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_results jsonb := '[]'::jsonb;
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null then
    raise exception 'Enter a valid phone number.';
  end if;

  v_results := v_results || jsonb_build_array(public.consume_rate_limit(
    'booking_attempt',
    3,
    10 * 60,
    'guest-ticket-phone:' || v_guest_phone
  ));

  v_results := v_results || jsonb_build_array(public.consume_rate_limit(
    'booking_attempt',
    6,
    60,
    'guest-ticket-slot:' ||
      coalesce(p_date::text, 'unknown-date') || ':' ||
      coalesce(p_start_time::text, 'unknown-time') || ':' ||
      lower(coalesce(nullif(btrim(p_ticket_type), ''), 'unknown-type'))
  ));

  return jsonb_build_object('allowed', true, 'checks', v_results);
end;
$$;

revoke all on function public.consume_guest_ticket_booking_rate_limit(text, date, time, text) from public, anon, authenticated;
grant execute on function public.consume_guest_ticket_booking_rate_limit(text, date, time, text) to service_role;

do $$
declare
  v_definition text;
  v_next_definition text;
  v_anchor text := $anchor$
  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;
$anchor$;
  v_patch text := $patch$
  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  perform public.consume_guest_ticket_booking_rate_limit(
    v_guest_phone,
    p_date,
    p_start_time,
    p_ticket_type
  );
$patch$;
begin
  select pg_get_functiondef('public.create_guest_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,text,text)'::regprocedure)
  into v_definition;

  if position('consume_guest_ticket_booking_rate_limit' in v_definition) = 0 then
    v_next_definition := replace(v_definition, v_anchor, v_patch);

    if v_next_definition = v_definition then
      raise exception 'Could not patch create_guest_ticket_booking rate limit guard.';
    end if;

    execute v_next_definition;
  end if;
end $$;

revoke all on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text) to anon, authenticated, service_role;

revoke all on function public.enqueue_due_session_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_due_session_reminders() to service_role;

notify pgrst, 'reload schema';

commit;
