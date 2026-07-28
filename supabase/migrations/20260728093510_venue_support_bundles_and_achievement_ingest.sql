begin;

create or replace function public.validate_matched_venue_result_check_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.match_status <> 'session_matched' then
    return new;
  end if;

  update public.session_participants
  set checked_in = true,
      checked_in_at = coalesce(checked_in_at, new.captured_at),
      updated_at = now()
  where id = new.matched_participant_id
    and session_id = new.matched_session_id
    and profile_id = new.profile_id
    and deleted_at is null;

  if not found then
    raise exception 'Matched participant is no longer available.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_matched_venue_result_check_in()
from public, anon, authenticated;
grant execute on function public.validate_matched_venue_result_check_in()
to service_role;

drop trigger if exists venue_game_results_validate_check_in
on public.venue_game_results;
create trigger venue_game_results_validate_check_in
after insert on public.venue_game_results
for each row
execute function public.validate_matched_venue_result_check_in();

update public.session_participants participant
set checked_in = true,
    checked_in_at = coalesce(participant.checked_in_at, result.captured_at),
    updated_at = now()
from public.venue_game_results result
where result.match_status = 'session_matched'
  and result.matched_participant_id = participant.id
  and result.matched_session_id = participant.session_id
  and result.profile_id = participant.profile_id
  and participant.deleted_at is null
  and (
    participant.checked_in is distinct from true
    or participant.checked_in_at is null
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'venue-support-bundles',
  'venue-support-bundles',
  false,
  3500000,
  array['application/zip', 'application/octet-stream']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.venue_support_bundles (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_name text not null,
  file_size_bytes integer not null,
  sha256 text not null,
  source_device text not null,
  app_version text not null,
  uploaded_at timestamptz not null default now(),
  constraint venue_support_bundles_storage_path_check
    check (storage_path ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]{36}/[^/]+\.zip$'),
  constraint venue_support_bundles_file_name_check
    check (file_name ~ '^VRena-Results-Capture-Support-[0-9]{8}-[0-9]{6}\.zip$'),
  constraint venue_support_bundles_file_size_check
    check (file_size_bytes between 1 and 3500000),
  constraint venue_support_bundles_sha256_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint venue_support_bundles_source_device_check
    check (char_length(source_device) between 1 and 120),
  constraint venue_support_bundles_app_version_check
    check (char_length(app_version) between 1 and 40)
);

create index if not exists venue_support_bundles_uploaded_idx
on public.venue_support_bundles (uploaded_at desc);

alter table public.venue_support_bundles enable row level security;
revoke all on table public.venue_support_bundles from public, anon, authenticated;
grant select, insert, update, delete on table public.venue_support_bundles to service_role;

comment on table public.venue_support_bundles is
  'Private metadata for operator-initiated Windows support bundle uploads.';

create table if not exists public.venue_support_bundle_download_tokens (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.venue_support_bundles(id) on delete cascade,
  token_digest text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint venue_support_bundle_download_token_digest_check
    check (token_digest ~ '^[0-9a-f]{64}$'),
  constraint venue_support_bundle_download_token_expiry_check
    check (expires_at > created_at)
);

create index if not exists venue_support_bundle_download_tokens_bundle_idx
on public.venue_support_bundle_download_tokens (bundle_id, created_at desc);

alter table public.venue_support_bundle_download_tokens enable row level security;
revoke all on table public.venue_support_bundle_download_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.venue_support_bundle_download_tokens to service_role;

comment on table public.venue_support_bundle_download_tokens is
  'Hashed, expiring, single-use tokens for private support bundle retrieval.';

create or replace function public.service_consume_venue_support_bundle_token(
  p_bundle_id uuid,
  p_token_digest text
)
returns table (
  storage_path text,
  file_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  return query
  with consumed as (
    update public.venue_support_bundle_download_tokens token
    set used_at = now()
    where token.bundle_id = p_bundle_id
      and token.token_digest = lower(p_token_digest)
      and token.used_at is null
      and token.expires_at > now()
    returning token.bundle_id
  )
  select bundle.storage_path, bundle.file_name
  from consumed
  join public.venue_support_bundles bundle
    on bundle.id = consumed.bundle_id;
end;
$$;

revoke all on function public.service_consume_venue_support_bundle_token(uuid, text)
from public, anon, authenticated;
grant execute on function public.service_consume_venue_support_bundle_token(uuid, text)
to service_role;

commit;
