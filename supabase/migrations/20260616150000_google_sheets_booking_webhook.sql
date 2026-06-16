create schema if not exists extensions;

create extension if not exists pg_net with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.integration_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table private.integration_settings enable row level security;

revoke all on private.integration_settings from public, anon, authenticated;
grant select, insert, update, delete on private.integration_settings to service_role;

comment on table private.integration_settings is
  'Private integration configuration. Set google_sheets_webhook_url and google_sheets_webhook_secret after deploying the Google Apps Script web app.';

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
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
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
    profiles.phone
  into v_owner_name, v_owner_email, v_owner_phone
  from public.profiles
  where profiles.id = new.owner_id;

  if new.ticket_customer_id is not null then
    select
      coalesce(profiles.nickname, profiles.full_name, profiles.phone, profiles.email, 'Unknown'),
      profiles.email,
      profiles.phone
    into v_customer_name, v_customer_email, v_customer_phone
    from public.profiles
    where profiles.id = new.ticket_customer_id;
  end if;

  v_payload := jsonb_build_object(
    'secret', v_webhook_secret,
    'source', 'supabase',
    'event_type', v_event_type,
    'created_at', now(),
    'app_url', 'https://vrena-booking.vercel.app',
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
      'phone', v_owner_phone
    ),
    'customer', jsonb_build_object(
      'id', coalesce(new.ticket_customer_id, new.owner_id),
      'name', coalesce(v_customer_name, v_owner_name, 'Unknown'),
      'email', coalesce(v_customer_email, v_owner_email),
      'phone', coalesce(v_customer_phone, v_owner_phone)
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

drop trigger if exists sessions_google_sheets_insert_trigger on public.sessions;

create trigger sessions_google_sheets_insert_trigger
after insert on public.sessions
for each row
execute function public.notify_google_sheets_session_insert();

-- After deploying the Google Apps Script web app, run this in Supabase SQL editor:
--
-- insert into private.integration_settings (key, value)
-- values
--   ('google_sheets_webhook_url', 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'),
--   ('google_sheets_webhook_secret', 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET')
-- on conflict (key) do update
-- set value = excluded.value,
--     updated_at = now();
