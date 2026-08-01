begin;

create table if not exists public.venue_game_result_duplicate_archive (
  archive_id uuid primary key default gen_random_uuid(),
  original_result_id uuid not null unique,
  archive_reason text not null,
  result_data jsonb not null,
  archived_at timestamptz not null default now(),
  constraint venue_game_result_duplicate_archive_reason_check
    check (char_length(archive_reason) between 1 and 120),
  constraint venue_game_result_duplicate_archive_data_check
    check (jsonb_typeof(result_data) = 'object')
);

alter table public.venue_game_result_duplicate_archive enable row level security;
revoke all on table public.venue_game_result_duplicate_archive from public, anon, authenticated;
grant select, insert, update, delete on table public.venue_game_result_duplicate_archive to service_role;

comment on table public.venue_game_result_duplicate_archive is
  'Private, recoverable archive of venue result rows removed by round deduplication.';

with ranked_results as (
  select
    result.id,
    row_number() over (
      partition by
        result.profile_id,
        (result.captured_at at time zone 'Asia/Ho_Chi_Minh')::date,
        lower(btrim(result.external_session_label))
      order by result.captured_at, result.created_at, result.id
    ) as duplicate_rank
  from public.venue_game_results result
  where nullif(btrim(result.external_session_label), '') is not null
),
archived_results as (
  insert into public.venue_game_result_duplicate_archive (
    original_result_id,
    archive_reason,
    result_data
  )
  select
    result.id,
    'duplicate profile result for the same venue session and local day',
    to_jsonb(result)
  from public.venue_game_results result
  join ranked_results ranked on ranked.id = result.id
  where ranked.duplicate_rank > 1
  on conflict (original_result_id) do update
  set archive_reason = excluded.archive_reason,
      result_data = excluded.result_data,
      archived_at = now()
  returning original_result_id
)
delete from public.venue_game_results result
using archived_results archived
where result.id = archived.original_result_id;

create unique index if not exists venue_game_results_profile_external_session_day_uidx
on public.venue_game_results (
  profile_id,
  ((captured_at at time zone 'Asia/Ho_Chi_Minh')::date),
  (lower(btrim(external_session_label)))
)
where nullif(btrim(external_session_label), '') is not null;

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  insert into public.venue_game_results (
    profile_id,
    matched_session_id,
    matched_participant_id,
    player_name,
    game_name,
    game_slug,
    score,
    hits,
    accuracy_percent,
    movement_meters,
    external_session_label,
    captured_at,
    source_capture_id,
    source_device,
    match_status
  )
  values (
    p_profile_id,
    p_matched_session_id,
    p_matched_participant_id,
    p_player_name,
    p_game_name,
    p_game_slug,
    p_score,
    p_hits,
    p_accuracy_percent,
    p_movement_meters,
    p_external_session_label,
    p_captured_at,
    p_source_capture_id,
    p_source_device,
    p_match_status
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
  timestamptz, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, uuid, uuid
) to service_role;

commit;
