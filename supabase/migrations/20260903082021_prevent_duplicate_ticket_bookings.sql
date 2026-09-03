begin;

-- Serialize matching submissions before any availability, discount, or order work.
-- Failed transactions leave no reservation behind; cancelled bookings can be replaced.
create or replace function private.guard_duplicate_ticket_booking(
  p_venue_key text,
  p_customer_id uuid,
  p_guest_phone text,
  p_ticket_type text,
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_player_count integer,
  p_arena_count integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text;
  v_identity text;
begin
  if p_customer_id is not null then
    select regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g')
    into v_phone
    from public.profiles
    where id = p_customer_id;
  else
    v_phone := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  end if;
  v_phone := regexp_replace(coalesce(v_phone, ''), '(?!^)\+', '', 'g');
  v_identity := coalesce(nullif(v_phone, ''), p_customer_id::text);
  if v_identity is null or p_date is null or p_start_time is null then
    return; -- The booking function supplies its existing validation errors.
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array('ticket-submission', p_venue_key, v_identity, p_date, p_start_time)::text, 0
  ));

  -- A separate query after the lock sees the preceding transaction's committed row.
  if exists (
    select 1
    from public.sessions s
    join public.profiles p on p.id = s.ticket_customer_id
    where s.booking_type = 'ticket'
      and s.venue_key = p_venue_key
      and (s.ticket_customer_id = p_customer_id
        or (v_phone <> '' and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone))
      and s.date = p_date
      and s.start_time = p_start_time
      and s.duration_minutes = p_duration_minutes
      and s.ticket_type = p_ticket_type
      and s.ticket_player_count = p_player_count
      and s.arena_count = p_arena_count
      and s.deleted_at is null
      and s.status = 'open'
      and s.ticket_status in ('pending', 'confirmed')
      and s.created_at >= clock_timestamp() - interval '2 minutes'
  ) then
    -- Never disclose another guest's booking reference or account-claim credential.
    raise exception 'This booking was already submitted. Please check your confirmation or contact the shop before booking again.';
  end if;
end;
$$;

revoke all on function private.guard_duplicate_ticket_booking(text, uuid, text, text, date, time, integer, integer, integer)
  from public, anon, authenticated;

do $$
declare
  v_signature text;
  v_definition text;
  v_next text;
  v_guard text;
begin
  foreach v_signature in array array[
    'public.create_guest_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,text,text,text)',
    'public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text,text)',
    'public.create_cafe_ticket_booking_request(text,date,time,integer,integer,integer,text[],text,text,text)'
  ] loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if position('private.guard_duplicate_ticket_booking' in v_definition) > 0 then
      raise exception 'Duplicate booking guard already installed in %', v_signature;
    end if;
    if v_signature like 'public.create_guest_ticket_booking(%' then
      v_guard := E'\n  perform private.guard_duplicate_ticket_booking(\n    ''ha-do-centrosa'', null, p_guest_phone,';
    elsif v_signature like 'public.create_cafe_ticket_booking_request(%' then
      v_guard := E'\n  perform private.guard_duplicate_ticket_booking(\n    ''cafe-des-stagiaires'', auth.uid(), p_guest_phone,';
    else
      v_guard := E'\n  perform private.guard_duplicate_ticket_booking(\n    ''ha-do-centrosa'', auth.uid(), null,';
    end if;
    v_guard := v_guard || E'\n    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count\n  );\n';
    v_next := replace(v_definition, E'\nbegin\n', E'\nbegin\n' || v_guard);
    if v_next = v_definition then
      raise exception 'Could not install duplicate booking guard in %', v_signature;
    end if;
    execute v_next;
  end loop;
end;
$$;

-- Include the authoritative shop in both creation and update webhook payloads.
do $$
declare
  v_signature text;
  v_definition text;
  v_next text;
begin
  foreach v_signature in array array[
    'public.notify_google_sheets_session_insert()',
    'public.notify_google_sheets_session_update()'
  ] loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    v_next := replace(v_definition,
      E'''id'', new.id,\n      ''booking_type''',
      E'''id'', new.id,\n      ''venue_key'', new.venue_key,\n      ''booking_type''');
    v_next := replace(v_next,
      E'''id'', old.id,\n      ''booking_type''',
      E'''id'', old.id,\n      ''venue_key'', old.venue_key,\n      ''booking_type''');
    if v_next = v_definition then
      raise exception 'Could not include shop in %', v_signature;
    end if;
    execute v_next;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
