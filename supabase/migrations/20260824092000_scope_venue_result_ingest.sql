begin;

alter table public.sessions
  add column if not exists venue_key text not null default 'ha-do-centrosa';
alter table public.sessions
  drop constraint if exists sessions_venue_key_check;
alter table public.sessions
  add constraint sessions_venue_key_check
    check (venue_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create index if not exists sessions_venue_date_idx
  on public.sessions (venue_key, date, start_time)
  where deleted_at is null;

alter table public.venue_game_results
  add column if not exists venue_key text not null default 'ha-do-centrosa';
alter table public.venue_game_results
  drop constraint if exists venue_game_results_venue_key_check;
alter table public.venue_game_results
  add constraint venue_game_results_venue_key_check
    check (venue_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.venue_result_reviews
  add column if not exists venue_key text not null default 'ha-do-centrosa';
alter table public.venue_result_reviews
  drop constraint if exists venue_result_reviews_venue_key_check;
alter table public.venue_result_reviews
  add constraint venue_result_reviews_venue_key_check
    check (venue_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.venue_support_bundles
  add column if not exists venue_key text not null default 'ha-do-centrosa';
alter table public.venue_support_bundles
  drop constraint if exists venue_support_bundles_venue_key_check;
alter table public.venue_support_bundles
  add constraint venue_support_bundles_venue_key_check
    check (venue_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

drop index if exists public.venue_game_results_profile_external_session_day_uidx;
create unique index venue_game_results_profile_external_session_day_uidx
on public.venue_game_results (
  venue_key,
  profile_id,
  ((captured_at at time zone 'Asia/Ho_Chi_Minh')::date),
  (lower(btrim(external_session_label)))
)
where nullif(btrim(external_session_label), '') is not null;

create function public.service_ingest_venue_game_result(
  p_profile_id uuid,
  p_player_name text,
  p_game_name text,
  p_game_slug text,
  p_score integer,
  p_hits integer,
  p_accuracy_percent double precision,
  p_movement_meters numeric,
  p_external_session_label text,
  p_captured_at timestamptz,
  p_source_capture_id text,
  p_source_device text,
  p_match_status text,
  p_venue_key text,
  p_matched_session_id uuid default null,
  p_matched_participant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if coalesce(p_venue_key, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Valid venue scope required.';
  end if;

  if p_matched_session_id is not null then
    perform 1 from public.sessions
    where id = p_matched_session_id
      and venue_key = p_venue_key
      and deleted_at is null;
    if not found then
      raise exception 'Matched session is outside the authenticated venue.';
    end if;
  end if;

  insert into public.venue_game_results (
    venue_key, profile_id, matched_session_id, matched_participant_id,
    player_name, game_name, game_slug, score, hits, accuracy_percent,
    movement_meters, external_session_label, captured_at, source_capture_id,
    source_device, match_status
  ) values (
    p_venue_key, p_profile_id, p_matched_session_id, p_matched_participant_id,
    p_player_name, p_game_name, p_game_slug, p_score, p_hits,
    p_accuracy_percent, p_movement_meters, p_external_session_label,
    p_captured_at, p_source_capture_id, p_source_device, p_match_status
  )
  on conflict do nothing
  returning id into v_result_id;

  if v_result_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if p_matched_participant_id is not null then
    update public.session_participants
    set score = p_score,
        accuracy_percent = p_accuracy_percent,
        hits = p_hits,
        movement_meters = p_movement_meters,
        updated_at = now()
    where id = p_matched_participant_id
      and session_id = p_matched_session_id
      and profile_id = p_profile_id
      and deleted_at is null;
    if not found then
      raise exception 'Matched participant is no longer available.';
    end if;
  end if;

  return jsonb_build_object('id', v_result_id, 'status', 'saved');
end;
$$;

revoke all on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, text, uuid, uuid
) to service_role;

-- Keep the previous service-only signature during the rolling deployment. It
-- delegates to the scoped implementation and cannot ingest outside the only
-- venue supported by clients that predate venue-scoped credentials.
create or replace function public.service_ingest_venue_game_result(
  p_profile_id uuid,
  p_player_name text,
  p_game_name text,
  p_game_slug text,
  p_score integer,
  p_hits integer,
  p_accuracy_percent double precision,
  p_movement_meters numeric,
  p_external_session_label text,
  p_captured_at timestamptz,
  p_source_capture_id text,
  p_source_device text,
  p_match_status text,
  p_matched_session_id uuid default null,
  p_matched_participant_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.service_ingest_venue_game_result(
    p_profile_id => p_profile_id,
    p_player_name => p_player_name,
    p_game_name => p_game_name,
    p_game_slug => p_game_slug,
    p_score => p_score,
    p_hits => p_hits,
    p_accuracy_percent => p_accuracy_percent,
    p_movement_meters => p_movement_meters,
    p_external_session_label => p_external_session_label,
    p_captured_at => p_captured_at,
    p_source_capture_id => p_source_capture_id,
    p_source_device => p_source_device,
    p_match_status => p_match_status,
    p_venue_key => 'ha-do-centrosa',
    p_matched_session_id => p_matched_session_id,
    p_matched_participant_id => p_matched_participant_id
  );
$$;

revoke all on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, uuid, uuid
) to service_role;

notify pgrst, 'reload schema';

commit;
