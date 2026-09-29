-- Keep stable internal venue keys; change public references and wording only.
DO $migration$
DECLARE
  definition text;
  original_claims text := current_setting('request.jwt.claims', true);
BEGIN
  SELECT pg_get_functiondef('public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure) INTO definition;
  IF position('v_ticket_reference := ''CS-''' in definition) = 0 THEN
    RAISE EXCEPTION 'Expected booking reference generator not found';
  END IF;
  definition := replace(definition, 'v_ticket_reference := ''CS-''', 'v_ticket_reference := ''TD-''');
  definition := replace(definition, 'Cafe soft-opening request - ', 'VRena Thao Dien - ');
  definition := replace(definition, 'Vrena Thao Dien', 'VRena Thao Dien');
  definition := replace(definition, 'Cafe bookings use one arena.', 'VRena Thao Dien bookings use one arena.');
  EXECUTE definition;

  SELECT pg_get_functiondef('public.rate_limit_session_creates()'::regprocedure) INTO definition;
  IF position('^CS-' in definition) = 0 THEN RAISE EXCEPTION 'Expected guest reference guard not found'; END IF;
  EXECUTE replace(definition, '^CS-', '^TD-');

  -- Do not send booking-change notifications for this administrative rename.
  ALTER TABLE public.sessions DISABLE TRIGGER sessions_google_sheets_update_trigger;
  ALTER TABLE public.sessions DISABLE TRIGGER sessions_enqueue_change_push;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.sessions SET
    ticket_reference = regexp_replace(ticket_reference, '^CS-', 'TD-'),
    name = replace(replace(replace(name, 'Cafe soft-opening request - ', 'VRena Thao Dien - '), 'VRena Café des Stagiaires', 'VRena Thao Dien'), 'Vrena Thao Dien', 'VRena Thao Dien'),
    notes = replace(replace(replace(notes, 'VRena Café des Stagiaires', 'VRena Thao Dien'), 'Cafe des Stagiaires', 'VRena Thao Dien'), 'Vrena Thao Dien', 'VRena Thao Dien')
  WHERE venue_key = 'cafe-des-stagiaires'
    AND (ticket_reference LIKE 'CS-%' OR name LIKE 'Cafe soft-opening request%' OR name LIKE '%Vrena Thao Dien%' OR name LIKE '%Café des Stagiaires%' OR notes LIKE '%Vrena Thao Dien%' OR notes LIKE '%Cafe des Stagiaires%' OR notes LIKE '%Café des Stagiaires%');
  PERFORM set_config('request.jwt.claims', coalesce(original_claims, ''), true);
  ALTER TABLE public.sessions ENABLE TRIGGER sessions_google_sheets_update_trigger;
  ALTER TABLE public.sessions ENABLE TRIGGER sessions_enqueue_change_push;
END;
$migration$;
COMMENT ON FUNCTION public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text) IS 'Creates a pending VRena Thao Dien ticket request with a TD reference and Zalo confirmation.';
