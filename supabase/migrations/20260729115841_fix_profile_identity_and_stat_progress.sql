begin;

-- These helpers are referenced by authenticated profile updates and RLS policies.
-- Keep anonymous access revoked while restoring the authenticated grants.
revoke all on function public.normalize_player_identity(text) from public, anon;
grant execute on function public.normalize_player_identity(text) to authenticated, service_role;

revoke all on function public.can_view_session_row(uuid) from public, anon;
grant execute on function public.can_view_session_row(uuid) to authenticated, service_role;

create extension if not exists unaccent with schema extensions;

create or replace function public.service_profiles_for_venue_identity(p_player_name text)
returns table (
  id uuid,
  full_name text,
  nickname text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_identity text := public.normalize_player_identity(p_player_name);
  v_folded_identity text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if v_identity is null then
    return;
  end if;

  v_folded_identity := nullif(lower(extensions.unaccent(v_identity)), '');

  return query
    select profiles.id, profiles.full_name, profiles.nickname
    from public.profiles
    where profiles.deleted_at is null
      and (
        public.normalize_player_identity(profiles.full_name) = v_identity
        or public.normalize_player_identity(profiles.nickname) = v_identity
        or lower(extensions.unaccent(btrim(profiles.full_name))) = v_folded_identity
        or lower(extensions.unaccent(btrim(profiles.nickname))) = v_folded_identity
      )
    order by
      case
        when public.normalize_player_identity(profiles.full_name) = v_identity
          or public.normalize_player_identity(profiles.nickname) = v_identity
        then 0
        else 1
      end,
      profiles.id
    limit 2;
end;
$$;

revoke all on function public.service_profiles_for_venue_identity(text)
from public, anon, authenticated;
grant execute on function public.service_profiles_for_venue_identity(text)
to service_role;

comment on function public.service_profiles_for_venue_identity(text) is
  'Service-only player lookup using exact identity first and accent-folded equality as an OCR fallback.';

create or replace function public.get_my_player_game_count_overrides()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(overrides.scope, overrides.games_joined order by overrides.scope),
    '{}'::jsonb
  )
  from public.player_stat_overrides overrides
  where overrides.profile_id = auth.uid()
    and overrides.scope <> 'overall'
    and overrides.games_joined is not null;
$$;

revoke all on function public.get_my_player_game_count_overrides()
from public, anon;
grant execute on function public.get_my_player_game_count_overrides()
to authenticated, service_role;

comment on function public.get_my_player_game_count_overrides() is
  'Returns only the signed-in player game-count overrides used by shared achievement progress calculations.';

commit;

notify pgrst, 'reload schema';
