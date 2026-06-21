create or replace function public.get_soft_deleted_records(p_limit integer default 100)
returns table (
  entity_table text,
  entity_id uuid,
  label text,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_vrena_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  return query
  select rows.entity_table, rows.entity_id, rows.label, rows.deleted_at, rows.deleted_by, rows.delete_reason
  from (
    select
      'profiles'::text as entity_table,
      profiles.id as entity_id,
      coalesce(nullif(profiles.full_name, ''), nullif(profiles.email, ''), profiles.phone, profiles.id::text) as label,
      profiles.deleted_at,
      profiles.deleted_by,
      profiles.delete_reason
    from public.profiles
    where profiles.deleted_at is not null
    union all
    select
      'sessions'::text,
      sessions.id,
      coalesce(nullif(sessions.name, ''), sessions.id::text),
      sessions.deleted_at,
      sessions.deleted_by,
      sessions.delete_reason
    from public.sessions
    where sessions.deleted_at is not null
    union all
    select
      'session_participants'::text,
      session_participants.id,
      coalesce(nullif(session_participants.display_name, ''), session_participants.profile_id::text),
      session_participants.deleted_at,
      session_participants.deleted_by,
      session_participants.delete_reason
    from public.session_participants
    where session_participants.deleted_at is not null
    union all
    select
      'session_messages'::text,
      session_messages.id,
      coalesce(nullif(session_messages.author_display_name, ''), left(session_messages.body, 60), session_messages.id::text),
      session_messages.deleted_at,
      session_messages.deleted_by,
      session_messages.delete_reason
    from public.session_messages
    where session_messages.deleted_at is not null
    union all
    select
      'club_members'::text,
      club_members.id,
      coalesce(nullif(club_members.display_name, ''), club_members.profile_id::text),
      club_members.deleted_at,
      club_members.deleted_by,
      club_members.delete_reason
    from public.club_members
    where club_members.deleted_at is not null
    union all
    select
      'tournament_pools'::text,
      tournament_pools.id,
      coalesce(nullif(tournament_pools.name, ''), tournament_pools.id::text),
      tournament_pools.deleted_at,
      tournament_pools.deleted_by,
      tournament_pools.delete_reason
    from public.tournament_pools
    where tournament_pools.deleted_at is not null
    union all
    select
      'tournament_pool_entries'::text,
      tournament_pool_entries.id,
      coalesce(tournament_pool_entries.profile_id::text, tournament_pool_entries.participant_id::text, tournament_pool_entries.id::text),
      tournament_pool_entries.deleted_at,
      tournament_pool_entries.deleted_by,
      tournament_pool_entries.delete_reason
    from public.tournament_pool_entries
    where tournament_pool_entries.deleted_at is not null
    union all
    select
      'tournament_matches'::text,
      tournament_matches.id,
      coalesce(tournament_matches.stage || ' #' || tournament_matches.match_number::text, tournament_matches.id::text),
      tournament_matches.deleted_at,
      tournament_matches.deleted_by,
      tournament_matches.delete_reason
    from public.tournament_matches
    where tournament_matches.deleted_at is not null
  ) rows
  order by rows.deleted_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke all on function public.get_soft_deleted_records(integer) from public, anon;
grant execute on function public.get_soft_deleted_records(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
