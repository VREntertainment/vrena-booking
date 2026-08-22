begin;

-- Optional emails must use NULL so every email-less player remains distinct.
update public.profiles
set email = null
where email is not null
  and btrim(email) = '';

create or replace function private.normalize_profile_optional_contact_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

revoke all on function private.normalize_profile_optional_contact_fields() from public;

drop trigger if exists profiles_normalize_optional_contact_fields on public.profiles;
create trigger profiles_normalize_optional_contact_fields
before insert or update of email
on public.profiles
for each row
execute function private.normalize_profile_optional_contact_fields();

-- Full legal/display names may repeat. Only active player nicknames are unique.
create or replace function public.enforce_unique_player_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_id uuid;
  v_nickname text := public.normalize_player_identity(new.nickname);
begin
  if new.deleted_at is not null
    or coalesce(new.is_hr_record_only, false)
    or v_nickname is null
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('profile_nickname:' || v_nickname, 0));

  select profiles.id
  into v_conflict_id
  from public.profiles
  where profiles.deleted_at is null
    and not coalesce(profiles.is_hr_record_only, false)
    and profiles.id is distinct from new.id
    and public.normalize_player_identity(profiles.nickname) = v_nickname
  limit 1;

  if v_conflict_id is not null then
    raise exception using
      errcode = '23505',
      message = 'Player nickname is already in use.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_unique_player_identity()
from public, anon, authenticated, service_role;

drop trigger if exists profiles_unique_player_identity on public.profiles;
create trigger profiles_unique_player_identity
before insert or update of nickname, deleted_at, is_hr_record_only
on public.profiles
for each row
execute function public.enforce_unique_player_identity();

drop index if exists public.profiles_active_nickname_identity_idx;
create unique index profiles_active_nickname_identity_idx
on public.profiles (public.normalize_player_identity(nickname))
where deleted_at is null
  and not coalesce(is_hr_record_only, false);

create or replace function public.service_profile_nickname_available(
  p_nickname text,
  p_exclude_id uuid default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.normalize_player_identity(p_nickname) is not null
    and not exists (
      select 1
      from public.profiles
      where profiles.deleted_at is null
        and not coalesce(profiles.is_hr_record_only, false)
        and profiles.id is distinct from p_exclude_id
        and public.normalize_player_identity(profiles.nickname)
          = public.normalize_player_identity(p_nickname)
    );
$$;

revoke all on function public.service_profile_nickname_available(text, uuid)
from public, anon, authenticated;
grant execute on function public.service_profile_nickname_available(text, uuid)
to service_role;

comment on function public.enforce_unique_player_identity() is
  'Allows repeated full names while enforcing case-insensitive, trimmed nickname uniqueness for active player profiles.';

comment on function public.service_profile_nickname_available(text, uuid) is
  'Service-role preflight for active player nickname uniqueness.';

commit;

notify pgrst, 'reload schema';
