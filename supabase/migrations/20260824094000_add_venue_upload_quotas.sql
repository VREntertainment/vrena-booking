begin;

alter table public.venue_result_reviews
  add column if not exists file_size_bytes integer not null default 1;
alter table public.venue_result_reviews
  drop constraint if exists venue_result_reviews_file_size_check;
alter table public.venue_result_reviews
  add constraint venue_result_reviews_file_size_check
    check (file_size_bytes between 1 and 2000000);

create table if not exists private.venue_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  venue_key text not null,
  upload_kind text not null check (upload_kind in ('review', 'support')),
  reserved_bytes integer not null check (reserved_bytes > 0),
  created_at timestamptz not null default now()
);

revoke all on private.venue_upload_reservations from public, anon, authenticated;
grant all on private.venue_upload_reservations to service_role;

create or replace function public.service_reserve_venue_upload(
  p_venue_key text,
  p_upload_kind text,
  p_bytes integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_daily_bytes bigint;
  v_total_bytes bigint;
  v_pending_bytes bigint;
  v_daily_limit bigint;
  v_total_limit bigint;
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_venue_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_upload_kind not in ('review', 'support')
    or coalesce(p_bytes, 0) < 1 then
    raise exception 'Invalid venue upload reservation.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_venue_key || ':' || p_upload_kind, 0));
  delete from private.venue_upload_reservations where created_at < now() - interval '15 minutes';

  select coalesce(sum(reserved_bytes), 0) into v_pending_bytes
  from private.venue_upload_reservations
  where venue_key = p_venue_key and upload_kind = p_upload_kind;

  if p_upload_kind = 'review' then
    select coalesce(sum(file_size_bytes), 0),
           coalesce(sum(file_size_bytes) filter (where created_at >= now() - interval '24 hours'), 0)
    into v_total_bytes, v_daily_bytes
    from public.venue_result_reviews where venue_key = p_venue_key;
    v_daily_limit := 200000000;
    v_total_limit := 2000000000;
  else
    select coalesce(sum(file_size_bytes), 0),
           coalesce(sum(file_size_bytes) filter (where uploaded_at >= now() - interval '24 hours'), 0)
    into v_total_bytes, v_daily_bytes
    from public.venue_support_bundles where venue_key = p_venue_key;
    v_daily_limit := 50000000;
    v_total_limit := 500000000;
  end if;

  if v_daily_bytes + v_pending_bytes + p_bytes > v_daily_limit
    or v_total_bytes + v_pending_bytes + p_bytes > v_total_limit then
    raise exception 'Venue upload quota reached.';
  end if;

  insert into private.venue_upload_reservations (venue_key, upload_kind, reserved_bytes)
  values (p_venue_key, p_upload_kind, p_bytes)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.service_release_venue_upload(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  delete from private.venue_upload_reservations where id = p_reservation_id;
end;
$$;

revoke all on function public.service_reserve_venue_upload(text, text, integer) from public, anon, authenticated;
revoke all on function public.service_release_venue_upload(uuid) from public, anon, authenticated;
grant execute on function public.service_reserve_venue_upload(text, text, integer) to service_role;
grant execute on function public.service_release_venue_upload(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
