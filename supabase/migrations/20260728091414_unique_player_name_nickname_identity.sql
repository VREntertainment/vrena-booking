create or replace function public.normalize_player_identity(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(lower(btrim(p_value)), '');
$$;

revoke all on function public.normalize_player_identity(text) from public, anon, authenticated;
grant execute on function public.normalize_player_identity(text) to service_role;

create index if not exists profiles_active_full_name_identity_idx
on public.profiles (public.normalize_player_identity(full_name))
where deleted_at is null;

create index if not exists profiles_active_nickname_identity_idx
on public.profiles (public.normalize_player_identity(nickname))
where deleted_at is null;

create or replace function public.enforce_unique_player_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_id uuid;
  v_full_name text := public.normalize_player_identity(new.full_name);
  v_identity text;
  v_nickname text := public.normalize_player_identity(new.nickname);
begin
  if new.deleted_at is not null then
    return new;
  end if;

  for v_identity in
    select distinct identity_value
    from unnest(array[v_full_name, v_nickname]) as identity_values(identity_value)
    where identity_value is not null
    order by identity_value
  loop
    perform pg_advisory_xact_lock(hashtextextended('profile_identity:' || v_identity, 0));
  end loop;

  select profiles.id
  into v_conflict_id
  from public.profiles
  where profiles.deleted_at is null
    and profiles.id is distinct from new.id
    and (
      public.normalize_player_identity(profiles.full_name) in (v_full_name, v_nickname)
      or public.normalize_player_identity(profiles.nickname) in (v_full_name, v_nickname)
    )
  limit 1;

  if v_conflict_id is not null then
    raise exception using
      errcode = '23505',
      message = 'Player name or nickname is already in use.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_unique_player_identity() from public, anon, authenticated, service_role;

drop trigger if exists profiles_unique_player_identity on public.profiles;
create trigger profiles_unique_player_identity
before insert or update of full_name, nickname, deleted_at
on public.profiles
for each row
execute function public.enforce_unique_player_identity();

create or replace function public.service_profiles_for_venue_identity(p_player_name text)
returns table (
  id uuid,
  full_name text,
  nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity text := public.normalize_player_identity(p_player_name);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if v_identity is null then
    return;
  end if;

  return query
    select profiles.id, profiles.full_name, profiles.nickname
    from public.profiles
    where profiles.deleted_at is null
      and (
        public.normalize_player_identity(profiles.full_name) = v_identity
        or public.normalize_player_identity(profiles.nickname) = v_identity
      )
    order by profiles.id
    limit 2;
end;
$$;

revoke all on function public.service_profiles_for_venue_identity(text)
from public, anon, authenticated;
grant execute on function public.service_profiles_for_venue_identity(text)
to service_role;

comment on function public.service_profiles_for_venue_identity(text) is
  'Service-only exact player lookup across the shared full-name and nickname identity namespace.';
