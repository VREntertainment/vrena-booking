create or replace function public.notify_google_sheets_session_update()
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
  v_changed_fields text[] := array[]::text[];
  v_is_ticket boolean;
  v_is_cancelled boolean;
  v_payload jsonb;
begin
  if coalesce(new.seeded, false) then
    return new;
  end if;

  if old.name is distinct from new.name then
    v_changed_fields := array_append(v_changed_fields, 'name');
  end if;
  if old.date is distinct from new.date then
    v_changed_fields := array_append(v_changed_fields, 'date');
  end if;
  if old.start_time is distinct from new.start_time then
    v_changed_fields := array_append(v_changed_fields, 'start_time');
  end if;
  if old.duration_minutes is distinct from new.duration_minutes then
    v_changed_fields := array_append(v_changed_fields, 'duration_minutes');
  end if;
  if old.max_players is distinct from new.max_players then
    v_changed_fields := array_append(v_changed_fields, 'max_players');
  end if;
  if old.arena_count is distinct from new.arena_count then
    v_changed_fields := array_append(v_changed_fields, 'arena_count');
  end if;
  if old.session_type is distinct from new.session_type then
    v_changed_fields := array_append(v_changed_fields, 'session_type');
  end if;
  if old.visibility is distinct from new.visibility then
    v_changed_fields := array_append(v_changed_fields, 'visibility');
  end if;
  if old.status is distinct from new.status then
    v_changed_fields := array_append(v_changed_fields, 'status');
  end if;
  if old.game_options is distinct from new.game_options then
    v_changed_fields := array_append(v_changed_fields, 'game_options');
  end if;
  if old.confirmed_game_id is distinct from new.confirmed_game_id then
    v_changed_fields := array_append(v_changed_fields, 'confirmed_game_id');
  end if;
  if old.invite_code is distinct from new.invite_code then
    v_changed_fields := array_append(v_changed_fields, 'invite_code');
  end if;
  if old.notes is distinct from new.notes then
    v_changed_fields := array_append(v_changed_fields, 'notes');
  end if;
  if old.booking_type is distinct from new.booking_type then
    v_changed_fields := array_append(v_changed_fields, 'booking_type');
  end if;
  if old.ticket_type is distinct from new.ticket_type then
    v_changed_fields := array_append(v_changed_fields, 'ticket_type');
  end if;
  if old.ticket_player_count is distinct from new.ticket_player_count then
    v_changed_fields := array_append(v_changed_fields, 'ticket_player_count');
  end if;
  if old.ticket_unit_price is distinct from new.ticket_unit_price then
    v_changed_fields := array_append(v_changed_fields, 'ticket_unit_price');
  end if;
  if old.ticket_total_price is distinct from new.ticket_total_price then
    v_changed_fields := array_append(v_changed_fields, 'ticket_total_price');
  end if;
  if old.ticket_status is distinct from new.ticket_status then
    v_changed_fields := array_append(v_changed_fields, 'ticket_status');
  end if;
  if old.ticket_reference is distinct from new.ticket_reference then
    v_changed_fields := array_append(v_changed_fields, 'ticket_reference');
  end if;
  if old.ticket_customer_id is distinct from new.ticket_customer_id then
    v_changed_fields := array_append(v_changed_fields, 'ticket_customer_id');
  end if;
  if old.owner_id is distinct from new.owner_id then
    v_changed_fields := array_append(v_changed_fields, 'owner_id');
  end if;

  if coalesce(array_length(v_changed_fields, 1), 0) = 0 then
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
  v_is_ticket := coalesce(new.booking_type, 'community') = 'ticket';
  v_is_cancelled := (
    new.status = 'cancelled'
    and old.status is distinct from new.status
  ) or (
    new.ticket_status = 'cancelled'
    and old.ticket_status is distinct from new.ticket_status
  );

  v_event_type := case
    when v_is_ticket and v_is_cancelled then 'ticket_cancelled'
    when v_is_ticket then 'ticket_updated'
    when v_is_cancelled then 'session_cancelled'
    else 'session_updated'
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
    'changed_fields', to_jsonb(v_changed_fields),
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
    'previous_session', jsonb_build_object(
      'id', old.id,
      'booking_type', coalesce(old.booking_type, 'community'),
      'name', old.name,
      'date', old.date,
      'start_time', to_char(old.start_time, 'HH24:MI'),
      'duration_minutes', old.duration_minutes,
      'max_players', old.max_players,
      'arena_count', old.arena_count,
      'session_type', old.session_type,
      'visibility', old.visibility,
      'status', old.status,
      'game_options', coalesce(to_jsonb(old.game_options), '[]'::jsonb),
      'confirmed_game_id', old.confirmed_game_id,
      'invite_code', old.invite_code,
      'notes', old.notes,
      'ticket_type', old.ticket_type,
      'ticket_player_count', old.ticket_player_count,
      'ticket_unit_price', old.ticket_unit_price,
      'ticket_total_price', old.ticket_total_price,
      'ticket_status', old.ticket_status,
      'ticket_reference', old.ticket_reference,
      'ticket_customer_id', old.ticket_customer_id,
      'owner_id', old.owner_id
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
    'raw_session', to_jsonb(new),
    'previous_raw_session', to_jsonb(old)
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
    raise warning 'Google Sheets booking update webhook failed for session %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.notify_google_sheets_session_update() from public, anon, authenticated;
grant execute on function public.notify_google_sheets_session_update() to service_role;

drop trigger if exists sessions_google_sheets_update_trigger on public.sessions;

create trigger sessions_google_sheets_update_trigger
after update of
  name,
  date,
  start_time,
  duration_minutes,
  max_players,
  arena_count,
  session_type,
  visibility,
  status,
  game_options,
  confirmed_game_id,
  invite_code,
  notes,
  booking_type,
  ticket_type,
  ticket_player_count,
  ticket_unit_price,
  ticket_total_price,
  ticket_status,
  ticket_reference,
  ticket_customer_id,
  owner_id
on public.sessions
for each row
execute function public.notify_google_sheets_session_update();

notify pgrst, 'reload schema';
