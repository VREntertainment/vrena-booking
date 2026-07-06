alter table public.profiles
  add column if not exists personal_data_consent boolean not null default false,
  add column if not exists personal_data_consent_at timestamptz,
  add column if not exists privacy_policy_url text,
  add column if not exists terms_conditions_url text,
  add column if not exists consent_waiver_url text,
  add column if not exists legal_consent_version text;

grant update (
  personal_data_consent,
  personal_data_consent_at,
  privacy_policy_url,
  terms_conditions_url,
  consent_waiver_url,
  legal_consent_version
) on public.profiles to authenticated;

create or replace function public.notify_google_sheets_session_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, net
as $$
declare
  v_webhook_url text;
  v_webhook_secret text;
  v_event_type text;
  v_owner_name text;
  v_owner_email text;
  v_owner_phone text;
  v_owner_birthday date;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_birthday date;
  v_player_birthday date;
  v_player_age integer;
  v_minor_warning text;
  v_payload jsonb;
begin
  if coalesce(new.seeded, false) then
    return new;
  end if;

  select nullif(value, '')
    into v_webhook_url
  from private.integration_settings
  where key = 'google_sheets_webhook_url';

  if v_webhook_url is null then
    return new;
  end if;

  select coalesce(nullif(value, ''), '')
    into v_webhook_secret
  from private.integration_settings
  where key = 'google_sheets_webhook_secret';

  v_webhook_secret := coalesce(v_webhook_secret, '');

  v_event_type := case
    when new.booking_type = 'ticket' then 'ticket_booked'
    else 'session_created'
  end;

  select
    coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
    profiles.email,
    profiles.phone,
    profiles.birthday
  into v_owner_name, v_owner_email, v_owner_phone, v_owner_birthday
  from public.profiles
  where profiles.id = new.owner_id;

  if new.ticket_customer_id is not null then
    select
      coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
      profiles.email,
      profiles.phone,
      profiles.birthday
    into v_customer_name, v_customer_email, v_customer_phone, v_customer_birthday
    from public.profiles
    where profiles.id = new.ticket_customer_id;
  end if;

  v_player_birthday := coalesce(v_customer_birthday, v_owner_birthday);
  if v_player_birthday is not null then
    v_player_age := extract(year from age(current_date, v_player_birthday))::integer;
    if v_player_age < 13 then
      v_minor_warning := 'UNDER-13 PLAYER: Online booking/session creation should remain disabled. Staff must handle this manually with a parent/guardian.';
    elsif v_player_age < 18 then
      v_minor_warning := 'MINOR PLAYER: This user is under 18. Parent/guardian confirmation is required before confirming this booking/session.';
    end if;
  end if;

  v_payload := jsonb_build_object(
    'secret', v_webhook_secret,
    'source', 'supabase',
    'event_type', v_event_type,
    'created_at', now(),
    'app_url', 'https://vrena-booking.vercel.app',
    'minor_warning', v_minor_warning,
    'player_age', v_player_age,
    'session', jsonb_build_object(
      'id', new.id,
      'booking_type', coalesce(new.booking_type, 'community'),
      'name', new.name,
      'date', new.date,
      'start_time', to_char(new.start_time, 'HH24:MI'),
      'duration_minutes', new.duration_minutes,
      'max_players', new.max_players,
      'arena_count', new.arena_count,
      'session_type', new.session_type,
      'visibility', new.visibility,
      'status', new.status,
      'game_options', coalesce(to_jsonb(new.game_options), '[]'::jsonb),
      'confirmed_game_id', new.confirmed_game_id,
      'invite_code', new.invite_code,
      'notes', new.notes,
      'ticket_type', new.ticket_type,
      'ticket_player_count', new.ticket_player_count,
      'ticket_unit_price', new.ticket_unit_price,
      'ticket_total_price', new.ticket_total_price,
      'ticket_status', new.ticket_status,
      'ticket_reference', new.ticket_reference,
      'ticket_customer_id', new.ticket_customer_id,
      'owner_id', new.owner_id
    ),
    'owner', jsonb_build_object(
      'id', new.owner_id,
      'name', coalesce(v_owner_name, 'Unknown'),
      'email', v_owner_email,
      'phone', v_owner_phone,
      'birthday', v_owner_birthday
    ),
    'customer', jsonb_build_object(
      'id', coalesce(new.ticket_customer_id, new.owner_id),
      'name', coalesce(v_customer_name, v_owner_name, 'Unknown'),
      'email', coalesce(v_customer_email, v_owner_email),
      'phone', coalesce(v_customer_phone, v_owner_phone),
      'birthday', coalesce(v_customer_birthday, v_owner_birthday)
    ),
    'raw_session', to_jsonb(new)
  );

  perform net.http_post(
    url := v_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    raise warning 'Google Sheets booking webhook failed for session %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.notify_google_sheets_session_insert() from public, anon, authenticated;
grant execute on function public.notify_google_sheets_session_insert() to service_role;

notify pgrst, 'reload schema';
