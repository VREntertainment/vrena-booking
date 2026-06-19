create extension if not exists pgcrypto;

create table if not exists public.security_rate_limits (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null,
  action text not null,
  window_started_at timestamptz not null,
  reset_at timestamptz not null,
  attempt_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (subject_hash, action, window_started_at)
);

create index if not exists security_rate_limits_reset_idx
on public.security_rate_limits (reset_at);

alter table public.security_rate_limits enable row level security;

create or replace function public.consume_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_reset_at timestamptz;
  v_headers jsonb := '{}'::jsonb;
  v_ip text := 'unknown';
  v_actor text := coalesce((select auth.uid())::text, '');
  v_subject text;
  v_hash text;
  v_count integer;
begin
  if p_action not in ('login_attempt', 'otp_request', 'join_leave', 'booking_attempt', 'admin_destructive') then
    raise exception 'Unknown rate limit action.';
  end if;

  if coalesce(p_limit, 0) < 1 or coalesce(p_window_seconds, 0) < 1 then
    raise exception 'Invalid rate limit configuration.';
  end if;

  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := split_part(coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'x-real-ip',
    'unknown'
  ), ',', 1);
  v_subject := lower(coalesce(nullif(btrim(p_subject), ''), v_actor, 'anonymous'));
  v_hash := encode(digest(lower(p_action) || ':' || v_actor || ':' || v_subject || ':' || v_ip, 'sha256'), 'hex');
  v_window_started_at := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_window_started_at + make_interval(secs => p_window_seconds);

  delete from public.security_rate_limits
  where reset_at < v_now - interval '1 day';

  insert into public.security_rate_limits (
    subject_hash,
    action,
    window_started_at,
    reset_at,
    attempt_count,
    last_seen_at
  )
  values (
    v_hash,
    p_action,
    v_window_started_at,
    v_reset_at,
    1,
    v_now
  )
  on conflict (subject_hash, action, window_started_at)
  do update
  set attempt_count = public.security_rate_limits.attempt_count + 1,
      last_seen_at = excluded.last_seen_at,
      reset_at = excluded.reset_at
  returning attempt_count into v_count;

  if v_count > p_limit then
    raise exception 'Too many attempts. Please wait a moment and try again.';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_reset_at
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer, text) from public;
grant execute on function public.consume_rate_limit(text, integer, integer, text) to anon, authenticated, service_role;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles',
    'sessions',
    'session_participants',
    'session_messages',
    'club_members',
    'tournament_pools',
    'tournament_pool_entries',
    'tournament_matches'
  ]
  loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', v_table);
    execute format('alter table public.%I add column if not exists deleted_by uuid', v_table);
    execute format('alter table public.%I add column if not exists delete_reason text', v_table);
    execute format(
      'create index if not exists %I on public.%I (deleted_at) where deleted_at is null',
      v_table || '_active_deleted_at_idx',
      v_table
    );
  end loop;
end $$;

do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.session_participants'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%session_id%'
      and pg_get_constraintdef(oid) ilike '%profile_id%'
  loop
    execute format('alter table public.session_participants drop constraint %I', v_constraint);
  end loop;

  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.club_members'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%club_id%'
      and pg_get_constraintdef(oid) ilike '%profile_id%'
  loop
    execute format('alter table public.club_members drop constraint %I', v_constraint);
  end loop;
end $$;

create unique index if not exists session_participants_active_session_profile_key
on public.session_participants (session_id, profile_id)
where deleted_at is null;

create unique index if not exists club_members_active_club_profile_key
on public.club_members (club_id, profile_id)
where deleted_at is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (
      role is null
      or lower(role) in ('super_admin', 'owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player')
    ) not valid;
end $$;

create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
as $$
  select case
    when lower(coalesce(p_email, '')) = 'emile@vre-vietnam.com' then 120
    when lower(coalesce(p_role, '')) = 'super_admin' then 120
    when lower(coalesce(p_email, '')) = 'contact@vre-vietnam.com' then 100
    when lower(coalesce(p_role, '')) in ('owner', 'admin') then 100
    when lower(coalesce(p_role, '')) = 'manager' then 80
    when lower(coalesce(p_role, '')) in ('staff', 'cashier') then 50
    when lower(coalesce(p_role, '')) = 'viewer' then 20
    else 0
  end;
$$;

create or replace function public.current_staff_role_rank()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(max(public.staff_role_rank(role, email)), 0)
  from public.profiles
  where id = (select auth.uid())
    and deleted_at is null;
$$;

create or replace function public.is_staff_console_user(p_min_rank integer default 20)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= p_min_rank;
$$;

create or replace function public.is_vrena_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= 100;
$$;

create or replace function public.is_vrena_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= 120;
$$;

revoke all on function public.staff_role_rank(text, text) from public;
revoke all on function public.current_staff_role_rank() from public;
revoke all on function public.is_staff_console_user(integer) from public;
revoke all on function public.is_vrena_admin() from public;
revoke all on function public.is_vrena_super_admin() from public;
grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;
grant execute on function public.is_staff_console_user(integer) to authenticated, service_role;
grant execute on function public.is_vrena_admin() to authenticated, service_role;
grant execute on function public.is_vrena_super_admin() to authenticated, service_role;

update public.profiles
set role = 'super_admin',
    updated_at = now()
where lower(coalesce(email, '')) = 'emile@vre-vietnam.com'
  and deleted_at is null;

create or replace function public.set_staff_profile_role(
  p_profile_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
begin
  if v_actor is null or not public.is_vrena_admin() then
    raise exception 'Admin access required.';
  end if;

  perform public.consume_rate_limit('admin_destructive', 3, 60, 'role:' || p_profile_id::text);

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if v_new_role not in ('super_admin', 'owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid staff role.';
  end if;

  select role
  into v_old_role
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if (v_new_role = 'super_admin' or lower(coalesce(v_old_role, '')) = 'super_admin')
    and not public.is_vrena_super_admin()
  then
    raise exception 'Super Admin access required.';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_profile_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    'role_updated',
    'profile',
    p_profile_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_new_role)
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'old_role', v_old_role,
    'role', v_new_role
  );
end;
$$;

revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;

create or replace function public.soft_delete_record(
  p_entity_table text,
  p_entity_id uuid,
  p_delete_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_table text := lower(nullif(btrim(coalesce(p_entity_table, '')), ''));
  v_allowed boolean := false;
  v_is_admin boolean := public.is_vrena_admin();
  v_count integer := 0;
  v_session_id uuid;
  v_profile_id uuid;
  v_owner_id uuid;
  v_club_id uuid;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if p_entity_id is null then
    raise exception 'Record id is required.';
  end if;

  if v_table not in ('profiles', 'sessions', 'session_participants', 'session_messages', 'club_members', 'tournament_pools', 'tournament_pool_entries', 'tournament_matches') then
    raise exception 'Unsupported soft-delete table.';
  end if;

  if v_table = 'profiles' then
    v_allowed := p_entity_id = v_actor or public.is_vrena_super_admin();
  elsif v_table = 'sessions' then
    select owner_id into v_owner_id
    from public.sessions
    where id = p_entity_id;
    v_allowed := v_is_admin or v_owner_id = v_actor;
  elsif v_table = 'session_participants' then
    select session_participants.session_id, session_participants.profile_id, sessions.owner_id
    into v_session_id, v_profile_id, v_owner_id
    from public.session_participants
    join public.sessions on sessions.id = session_participants.session_id
    where session_participants.id = p_entity_id;
    v_allowed := v_is_admin
      or v_profile_id = v_actor
      or v_owner_id = v_actor
      or exists (
        select 1
        from public.tournament_editors
        where tournament_editors.session_id = v_session_id
          and tournament_editors.profile_id = v_actor
      );
  elsif v_table = 'session_messages' then
    v_allowed := v_is_admin;
  elsif v_table = 'club_members' then
    select club_members.club_id, club_members.profile_id, clubs.owner_id
    into v_club_id, v_profile_id, v_owner_id
    from public.club_members
    join public.clubs on clubs.id = club_members.club_id
    where club_members.id = p_entity_id;
    v_allowed := v_is_admin
      or v_profile_id = v_actor
      or v_owner_id = v_actor
      or exists (
        select 1
        from public.club_members actor_membership
        where actor_membership.club_id = v_club_id
          and actor_membership.profile_id = v_actor
          and actor_membership.status = 'approved'
          and actor_membership.deleted_at is null
          and actor_membership.role in ('owner', 'admin', 'moderator')
      );
  else
    execute format('select session_id from public.%I where id = $1', v_table)
    into v_session_id
    using p_entity_id;
    select owner_id into v_owner_id
    from public.sessions
    where id = v_session_id;
    v_allowed := v_is_admin
      or v_owner_id = v_actor
      or exists (
        select 1
        from public.tournament_editors
        where tournament_editors.session_id = v_session_id
          and tournament_editors.profile_id = v_actor
      );
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Not allowed to delete this record.';
  end if;

  if v_is_admin then
    perform public.consume_rate_limit('admin_destructive', 3, 60, v_table || ':' || p_entity_id::text);
  end if;

  execute format(
    'update public.%I set deleted_at = now(), deleted_by = $1, delete_reason = $2 where id = $3 and deleted_at is null',
    v_table
  )
  using v_actor, nullif(btrim(coalesce(p_delete_reason, '')), ''), p_entity_id;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No active record found to delete.';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
  values (
    v_actor,
    'soft_deleted',
    v_table,
    p_entity_id,
    jsonb_build_object('reason', p_delete_reason)
  );

  return jsonb_build_object('deleted', true, 'entity_table', v_table, 'entity_id', p_entity_id);
end;
$$;

revoke all on function public.soft_delete_record(text, uuid, text) from public, anon;
grant execute on function public.soft_delete_record(text, uuid, text) to authenticated, service_role;

create or replace function public.soft_delete_tournament_records(
  p_session_id uuid,
  p_include_pools boolean default false,
  p_delete_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean := public.is_vrena_admin();
  v_owner_id uuid;
  v_reason text := nullif(btrim(coalesce(p_delete_reason, '')), '');
  v_matches integer := 0;
  v_entries integer := 0;
  v_pools integer := 0;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  select owner_id into v_owner_id
  from public.sessions
  where id = p_session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  if not (
    v_is_admin
    or v_owner_id = v_actor
    or exists (
      select 1
      from public.tournament_editors
      where tournament_editors.session_id = p_session_id
        and tournament_editors.profile_id = v_actor
    )
  ) then
    raise exception 'Not allowed to update tournament records.';
  end if;

  if v_is_admin then
    perform public.consume_rate_limit('admin_destructive', 3, 60, 'tournament:' || p_session_id::text);
  end if;

  update public.tournament_matches
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = v_reason
  where session_id = p_session_id
    and deleted_at is null;
  get diagnostics v_matches = row_count;

  if coalesce(p_include_pools, false) then
    update public.tournament_pool_entries
    set deleted_at = now(),
        deleted_by = v_actor,
        delete_reason = v_reason
    where session_id = p_session_id
      and deleted_at is null;
    get diagnostics v_entries = row_count;

    update public.tournament_pools
    set deleted_at = now(),
        deleted_by = v_actor,
        delete_reason = v_reason
    where session_id = p_session_id
      and deleted_at is null;
    get diagnostics v_pools = row_count;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
  values (
    v_actor,
    'tournament_records_soft_deleted',
    'session',
    p_session_id,
    jsonb_build_object('matches', v_matches, 'entries', v_entries, 'pools', v_pools, 'reason', v_reason)
  );

  return jsonb_build_object('matches', v_matches, 'entries', v_entries, 'pools', v_pools);
end;
$$;

revoke all on function public.soft_delete_tournament_records(uuid, boolean, text) from public, anon;
grant execute on function public.soft_delete_tournament_records(uuid, boolean, text) to authenticated, service_role;

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
    select 'profiles'::text as entity_table, id as entity_id, coalesce(nullif(full_name, ''), nullif(email, ''), phone, id::text) as label, deleted_at, deleted_by, delete_reason
    from public.profiles
    where deleted_at is not null
    union all
    select 'sessions'::text, id, coalesce(nullif(name, ''), id::text), deleted_at, deleted_by, delete_reason
    from public.sessions
    where deleted_at is not null
    union all
    select 'session_participants'::text, id, coalesce(nullif(display_name, ''), profile_id::text), deleted_at, deleted_by, delete_reason
    from public.session_participants
    where deleted_at is not null
    union all
    select 'session_messages'::text, id, coalesce(nullif(author_display_name, ''), left(body, 60), id::text), deleted_at, deleted_by, delete_reason
    from public.session_messages
    where deleted_at is not null
    union all
    select 'club_members'::text, id, coalesce(nullif(display_name, ''), profile_id::text), deleted_at, deleted_by, delete_reason
    from public.club_members
    where deleted_at is not null
    union all
    select 'tournament_pools'::text, id, coalesce(nullif(name, ''), id::text), deleted_at, deleted_by, delete_reason
    from public.tournament_pools
    where deleted_at is not null
    union all
    select 'tournament_pool_entries'::text, id, coalesce(profile_id::text, participant_id::text, id::text), deleted_at, deleted_by, delete_reason
    from public.tournament_pool_entries
    where deleted_at is not null
    union all
    select 'tournament_matches'::text, id, coalesce(stage || ' #' || match_number::text, id::text), deleted_at, deleted_by, delete_reason
    from public.tournament_matches
    where deleted_at is not null
  ) rows
  order by rows.deleted_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke all on function public.get_soft_deleted_records(integer) from public, anon;
grant execute on function public.get_soft_deleted_records(integer) to authenticated, service_role;

create or replace function public.restore_soft_deleted_record(
  p_entity_table text,
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_table text := lower(nullif(btrim(coalesce(p_entity_table, '')), ''));
  v_count integer := 0;
begin
  if v_actor is null or not public.is_vrena_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  if v_table not in ('profiles', 'sessions', 'session_participants', 'session_messages', 'club_members', 'tournament_pools', 'tournament_pool_entries', 'tournament_matches') then
    raise exception 'Unsupported restore table.';
  end if;

  execute format(
    'update public.%I set deleted_at = null, deleted_by = null, delete_reason = null where id = $1 and deleted_at is not null',
    v_table
  )
  using p_entity_id;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No deleted record found to restore.';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id)
  values (v_actor, 'restored_soft_deleted', v_table, p_entity_id);

  return jsonb_build_object('restored', true, 'entity_table', v_table, 'entity_id', p_entity_id);
end;
$$;

revoke all on function public.restore_soft_deleted_record(text, uuid) from public, anon;
grant execute on function public.restore_soft_deleted_record(text, uuid) to authenticated, service_role;

create or replace function public.get_leaderboard_players_page(
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null,
  p_rank_by text default 'totalScore',
  p_profile_id uuid default null,
  p_club_id uuid default null,
  p_club_pin text default null
)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  sessions_joined integer,
  games_joined integer,
  wins integer,
  best_performer_count integer,
  base_total_score integer,
  total_score integer,
  score_adjustment integer,
  total_accuracy double precision,
  accuracy_count integer,
  total_projectiles integer,
  average_accuracy double precision,
  reliability_score double precision,
  best_by_game jsonb,
  leaderboard_rank integer,
  leaderboard_distinct_rank integer,
  leaderboard_higher_metric_value double precision,
  leaderboard_metric_value double precision,
  leaderboard_total_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized_args as (
    select
      greatest(1, least(coalesce(p_limit, 20), 5000))::integer as page_limit,
      greatest(0, coalesce(p_offset, 0))::integer as page_offset,
      nullif(trim(coalesce(p_search, '')), '') as search_value,
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by,
      nullif(regexp_replace(upper(coalesce(p_club_pin, '')), '[^A-Z0-9]', '', 'g'), '') as club_pin
  ),
  active_sessions as (
    select
      sessions.id,
      sessions.game_options
    from public.sessions
    where sessions.status <> 'cancelled'
      and sessions.deleted_at is null
  ),
  participant_rows as (
    select
      session_participants.id,
      session_participants.session_id,
      session_participants.profile_id,
      session_participants.checked_in,
      session_participants.score,
      session_participants.accuracy_percent,
      session_participants.projectiles_fired,
      session_participants.escape_duration_seconds,
      session_participants.placement,
      active_sessions.game_options
    from public.session_participants
    join active_sessions
      on active_sessions.id = session_participants.session_id
    where session_participants.deleted_at is null
  ),
  session_score_state as (
    select
      participant_rows.session_id,
      count(*)::integer as participant_count,
      count(participant_rows.score)::integer as scored_count,
      max(participant_rows.score) as best_score
    from participant_rows
    group by participant_rows.session_id
  ),
  unique_best_performers as (
    select
      participant_rows.id,
      participant_rows.session_id
    from participant_rows
    join session_score_state
      on session_score_state.session_id = participant_rows.session_id
    where session_score_state.participant_count >= 2
      and session_score_state.scored_count = session_score_state.participant_count
      and participant_rows.score = session_score_state.best_score
      and (
        select count(*)
        from participant_rows tied_rows
        where tied_rows.session_id = participant_rows.session_id
          and tied_rows.score = session_score_state.best_score
      ) = 1
  ),
  profile_stats as (
    select
      profiles.id as profile_id,
      count(participant_rows.id)::integer as sessions_joined,
      count(participant_rows.id) filter (where coalesce(participant_rows.checked_in, false))::integer as games_joined,
      count(participant_rows.id) filter (where participant_rows.placement = 1)::integer as wins,
      count(unique_best_performers.id)::integer as best_performer_count,
      coalesce(sum(participant_rows.score) filter (where participant_rows.score is not null), 0)::integer as base_total_score,
      coalesce(sum(participant_rows.accuracy_percent) filter (where participant_rows.accuracy_percent is not null), 0)::double precision as total_accuracy,
      count(participant_rows.accuracy_percent) filter (where participant_rows.accuracy_percent is not null)::integer as accuracy_count,
      coalesce(sum(participant_rows.projectiles_fired) filter (where participant_rows.projectiles_fired is not null), 0)::integer as total_projectiles,
      min(participant_rows.escape_duration_seconds) filter (
        where participant_rows.escape_duration_seconds is not null
          and participant_rows.escape_duration_seconds > 0
      )::integer as best_escape_duration_seconds
    from public.profiles
    left join participant_rows
      on participant_rows.profile_id = profiles.id
    left join unique_best_performers
      on unique_best_performers.id = participant_rows.id
    where profiles.deleted_at is null
    group by profiles.id
  ),
  participant_game_scores as (
    select
      participant_rows.profile_id,
      game_id,
      participant_rows.score,
      participant_rows.escape_duration_seconds
    from participant_rows
    cross join lateral unnest(coalesce(participant_rows.game_options, array[]::text[])) as game_id
    where participant_rows.score is not null
      or participant_rows.escape_duration_seconds is not null
  ),
  best_game_scores as (
    select
      participant_game_scores.profile_id,
      participant_game_scores.game_id,
      case
        when participant_game_scores.game_id in ('arc-of-the-covenant', 'joller-house') then min(participant_game_scores.score)
        else max(participant_game_scores.score)
      end::integer as score,
      min(participant_game_scores.escape_duration_seconds) filter (
        where participant_game_scores.game_id in ('arc-of-the-covenant', 'joller-house')
          and participant_game_scores.escape_duration_seconds is not null
          and participant_game_scores.escape_duration_seconds > 0
      )::integer as escape_duration_seconds
    from participant_game_scores
    group by participant_game_scores.profile_id, participant_game_scores.game_id
  ),
  best_game_json as (
    select
      best_game_scores.profile_id,
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'game',
          best_game_scores.game_id,
          'score',
          best_game_scores.score,
          'escapeDurationSeconds',
          best_game_scores.escape_duration_seconds
        ))
        order by
          best_game_scores.escape_duration_seconds asc nulls last,
          best_game_scores.score desc nulls last,
          best_game_scores.game_id
      ) as best_by_game
    from best_game_scores
    where best_game_scores.score is not null
      or best_game_scores.escape_duration_seconds is not null
    group by best_game_scores.profile_id
  ),
  base_rows as (
    select
      profiles.id as profile_id,
      public.profile_public_display_name(
        profiles.id,
        profiles.nickname,
        profiles.full_name,
        profiles.phone,
        profiles.anonymous_mode,
        profiles.anonymous_callsign
      ) as display_name,
      case when coalesce(profiles.anonymous_mode, false) then null else profiles.avatar_url end as avatar_url,
      case when coalesce(profiles.anonymous_mode, false) then '🎭' else profiles.avatar_emoji end as avatar_emoji,
      case when coalesce(profiles.anonymous_mode, false) then null else profiles.avatar_initials end as avatar_initials,
      case when coalesce(profiles.anonymous_mode, false) then '#11181b' else profiles.avatar_color end as avatar_color,
      case when coalesce(profiles.anonymous_mode, false) then '#ffffff' else profiles.avatar_text_color end as avatar_text_color,
      profiles.profile_motto,
      profile_stats.sessions_joined,
      profile_stats.games_joined,
      profile_stats.wins,
      profile_stats.best_performer_count,
      profile_stats.base_total_score,
      profile_stats.base_total_score + coalesce(profiles.score_adjustment, 0)::integer as total_score,
      coalesce(profiles.score_adjustment, 0)::integer as score_adjustment,
      profile_stats.total_accuracy,
      profile_stats.accuracy_count,
      profile_stats.total_projectiles,
      profile_stats.best_escape_duration_seconds,
      case
        when profile_stats.accuracy_count > 0 then profile_stats.total_accuracy / profile_stats.accuracy_count
        else null
      end as average_accuracy,
      case
        when profile_stats.sessions_joined > 0 then (profile_stats.games_joined::double precision / profile_stats.sessions_joined::double precision) * 100
        else 0
      end as reliability_score,
      coalesce(best_game_json.best_by_game, '[]'::jsonb) as best_by_game
    from public.profiles
    join profile_stats
      on profile_stats.profile_id = profiles.id
    left join best_game_json
      on best_game_json.profile_id = profiles.id
    where profiles.deleted_at is null
  ),
  current_profile as (
    select
      profiles.id,
      profiles.email,
      profiles.role
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.deleted_at is null
  ),
  selected_club as (
    select
      clubs.id,
      clubs.owner_id,
      clubs.visibility,
      nullif(regexp_replace(upper(coalesce(clubs.pin_code, '')), '[^A-Z0-9]', '', 'g'), '') as pin_code
    from public.clubs
    where clubs.id = p_club_id
  ),
  selected_club_access as (
    select
      selected_club.id,
      (
        selected_club.visibility = 'public'
        or selected_club.owner_id = auth.uid()
        or exists (
          select 1
          from current_profile
          where lower(coalesce(current_profile.role, '')) in ('super_admin', 'owner', 'admin')
            or lower(coalesce(current_profile.email, '')) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com')
        )
        or exists (
          select 1
          from public.club_members
          where club_members.club_id = selected_club.id
            and club_members.profile_id = auth.uid()
            and club_members.status = 'approved'
            and club_members.deleted_at is null
        )
        or exists (
          select 1
          from normalized_args
          where normalized_args.club_pin is not null
            and selected_club.pin_code is not null
            and normalized_args.club_pin = selected_club.pin_code
        )
      ) as can_view
    from selected_club
  ),
  selected_club_profile_ids as (
    select selected_club.owner_id as profile_id
    from selected_club
    join selected_club_access
      on selected_club_access.id = selected_club.id
     and selected_club_access.can_view
    union
    select club_members.profile_id
    from public.club_members
    join selected_club
      on selected_club.id = club_members.club_id
    join selected_club_access
      on selected_club_access.id = selected_club.id
     and selected_club_access.can_view
    where club_members.status = 'approved'
      and club_members.deleted_at is null
  ),
  filtered_rows as (
    select base_rows.*
    from base_rows
    cross join normalized_args
    where (
        normalized_args.search_value is null
        or lower(base_rows.display_name || ' ' || coalesce(base_rows.profile_motto, '')) like '%' || lower(normalized_args.search_value) || '%'
      )
      and (
        p_club_id is null
        or exists (
          select 1
          from selected_club_profile_ids
          where selected_club_profile_ids.profile_id = base_rows.profile_id
        )
      )
  ),
  metric_rows as (
    select
      filtered_rows.*,
      case normalized_args.rank_by
        when 'wins' then filtered_rows.wins::double precision
        when 'winRate' then case when filtered_rows.games_joined > 0 then (filtered_rows.wins::double precision / filtered_rows.games_joined::double precision) * 100 else 0 end
        when 'accuracy' then coalesce(filtered_rows.average_accuracy, 0)
        when 'reliability' then filtered_rows.reliability_score
        when 'projectiles' then filtered_rows.total_projectiles::double precision
        when 'gamesPlayed' then filtered_rows.games_joined::double precision
        when 'escapeTime' then coalesce(filtered_rows.best_escape_duration_seconds, 0)::double precision
        else filtered_rows.total_score::double precision
      end as metric_value
    from filtered_rows
    cross join normalized_args
  ),
  distinct_metric_values as (
    select
      distinct_values.metric_value,
      (dense_rank() over (
        order by
          case when normalized_args.rank_by = 'escapeTime' then distinct_values.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then distinct_values.metric_value end desc nulls last
      ))::integer as distinct_rank,
      lag(distinct_values.metric_value) over (
        order by
          case when normalized_args.rank_by = 'escapeTime' then distinct_values.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then distinct_values.metric_value end desc nulls last
      ) as higher_metric_value
    from (
      select distinct metric_rows.metric_value
      from metric_rows
      where metric_rows.metric_value > 0
    ) distinct_values
    cross join normalized_args
  ),
  ranked_rows as (
    select
      metric_rows.*,
      (rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_rank,
      (row_number() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last,
          metric_rows.total_score desc,
          metric_rows.best_performer_count desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count,
      distinct_metric_values.distinct_rank as leaderboard_distinct_rank,
      distinct_metric_values.higher_metric_value as leaderboard_higher_metric_value
    from metric_rows
    cross join normalized_args
    left join distinct_metric_values
      on distinct_metric_values.metric_value = metric_rows.metric_value
  )
  select
    ranked_rows.profile_id,
    ranked_rows.display_name,
    ranked_rows.avatar_url,
    ranked_rows.avatar_emoji,
    ranked_rows.avatar_initials,
    ranked_rows.avatar_color,
    ranked_rows.avatar_text_color,
    ranked_rows.profile_motto,
    ranked_rows.sessions_joined,
    ranked_rows.games_joined,
    ranked_rows.wins,
    ranked_rows.best_performer_count,
    ranked_rows.base_total_score,
    ranked_rows.total_score,
    ranked_rows.score_adjustment,
    ranked_rows.total_accuracy,
    ranked_rows.accuracy_count,
    ranked_rows.total_projectiles,
    ranked_rows.average_accuracy,
    ranked_rows.reliability_score,
    ranked_rows.best_by_game,
    ranked_rows.leaderboard_rank,
    ranked_rows.leaderboard_distinct_rank,
    ranked_rows.leaderboard_higher_metric_value,
    ranked_rows.metric_value as leaderboard_metric_value,
    ranked_rows.leaderboard_total_count
  from ranked_rows
  cross join normalized_args
  where (
      p_profile_id is not null
      and ranked_rows.profile_id = p_profile_id
    )
    or (
      p_profile_id is null
      and ranked_rows.page_position > normalized_args.page_offset
      and ranked_rows.page_position <= normalized_args.page_offset + normalized_args.page_limit
    )
  order by ranked_rows.page_position asc;
$$;

grant execute on function public.get_leaderboard_players_page(integer, integer, text, text, uuid, uuid, text) to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.session_waitlist') is not null then
    execute $promote$
      create or replace function public.promote_session_waitlist(p_session_id uuid)
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $function$
      declare
        v_session public.sessions%rowtype;
        v_waitlist public.session_waitlist%rowtype;
        v_participant_count integer;
      begin
        select *
        into v_session
        from public.sessions
        where id = p_session_id
          and status <> 'cancelled'
          and deleted_at is null
        for update;

        if not found then
          return;
        end if;

        select count(*)
        into v_participant_count
        from public.session_participants
        where session_id = p_session_id
          and deleted_at is null;

        if v_participant_count >= v_session.max_players then
          return;
        end if;

        select *
        into v_waitlist
        from public.session_waitlist
        where session_id = p_session_id
        order by created_at asc
        limit 1
        for update skip locked;

        if not found then
          return;
        end if;

        if not exists (
          select 1
          from public.session_participants
          where session_id = p_session_id
            and profile_id = v_waitlist.profile_id
            and deleted_at is null
        ) then
          insert into public.session_participants (
            session_id,
            profile_id,
            display_name,
            avatar_url,
            avatar_emoji,
            avatar_initials,
            avatar_color,
            avatar_text_color,
            profile_motto
          ) values (
            v_waitlist.session_id,
            v_waitlist.profile_id,
            v_waitlist.display_name,
            v_waitlist.avatar_url,
            v_waitlist.avatar_emoji,
            v_waitlist.avatar_initials,
            v_waitlist.avatar_color,
            v_waitlist.avatar_text_color,
            v_waitlist.profile_motto
          );
        end if;

        delete from public.session_waitlist where id = v_waitlist.id;
      end;
      $function$;
    $promote$;

    grant execute on function public.promote_session_waitlist(uuid) to authenticated;
  end if;
end $$;
