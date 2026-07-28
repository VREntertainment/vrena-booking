begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.player_zalo_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  zalo_app_user_id text not null unique,
  verified_phone text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint player_zalo_identities_zalo_id_length
    check (char_length(zalo_app_user_id) between 1 and 255),
  constraint player_zalo_identities_phone_format
    check (verified_phone ~ '^\+84[0-9]{8,10}$'),
  constraint player_zalo_identities_display_name_length
    check (display_name is null or char_length(display_name) <= 120)
);

create table public.player_zalo_handoffs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint player_zalo_handoffs_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint player_zalo_handoffs_expiry_after_creation
    check (expires_at > created_at),
  constraint player_zalo_handoffs_consumed_after_creation
    check (consumed_at is null or consumed_at >= created_at)
);

create index player_zalo_handoffs_active_token_idx
  on public.player_zalo_handoffs (token_hash, expires_at)
  where consumed_at is null;

create index player_zalo_handoffs_profile_created_idx
  on public.player_zalo_handoffs (profile_id, created_at desc);

create or replace function private.player_zalo_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger player_zalo_identities_touch_updated_at
before update on public.player_zalo_identities
for each row execute function private.player_zalo_touch_updated_at();

alter table public.player_zalo_identities enable row level security;
alter table public.player_zalo_handoffs enable row level security;

revoke all on table public.player_zalo_identities from public, anon, authenticated;
revoke all on table public.player_zalo_handoffs from public, anon, authenticated;
grant select, insert, update, delete on table public.player_zalo_identities to service_role;
grant select, insert, update, delete on table public.player_zalo_handoffs to service_role;

revoke all on function private.player_zalo_touch_updated_at() from public, anon, authenticated;

comment on table public.player_zalo_identities is
  'Server-only permanent mapping between a Zalo Mini App user and a VRena player profile.';
comment on table public.player_zalo_handoffs is
  'Server-only, single-use, short-lived handoff tokens used to establish a normal Supabase session.';
comment on column public.player_zalo_identities.verified_phone is
  'Phone number verified by the Zalo one-time phone token and normalized to Vietnamese E.164.';
comment on column public.player_zalo_handoffs.token_hash is
  'SHA-256 hash of an opaque handoff token. The raw token is never stored.';

notify pgrst, 'reload schema';

commit;
