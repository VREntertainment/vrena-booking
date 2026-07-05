alter table public.staff_games
  add column if not exists escape_chapter_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_games_escape_chapter_count_check'
      and conrelid = 'public.staff_games'::regclass
  ) then
    alter table public.staff_games
      add constraint staff_games_escape_chapter_count_check
      check (escape_chapter_count >= 1 and escape_chapter_count <= 50);
  end if;
end $$;

comment on column public.staff_games.escape_chapter_count is
  'Number of playable chapters for Escape games; used for per-chapter speedrun history.';

alter table public.profiles
  add column if not exists total_projectiles_override integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_total_projectiles_override_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_total_projectiles_override_check
      check (total_projectiles_override is null or total_projectiles_override >= 0);
  end if;
end $$;

create table if not exists public.session_participant_chapter_times (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  staff_game_id uuid references public.staff_games(id) on delete set null,
  game_slug text not null,
  chapter_number integer not null check (chapter_number >= 1 and chapter_number <= 50),
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 86400),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, game_slug, chapter_number)
);

create index if not exists session_participant_chapter_times_profile_idx
on public.session_participant_chapter_times (profile_id, game_slug, chapter_number, duration_seconds);

create index if not exists session_participant_chapter_times_session_idx
on public.session_participant_chapter_times (session_id, participant_id);

alter table public.session_participant_chapter_times enable row level security;

grant select on public.session_participant_chapter_times to authenticated;
grant insert, update, delete on public.session_participant_chapter_times to authenticated;
grant all on public.session_participant_chapter_times to service_role;

drop policy if exists "chapter times select own or staff" on public.session_participant_chapter_times;
create policy "chapter times select own or staff"
on public.session_participant_chapter_times
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_staff_console_user(20)
);

drop policy if exists "chapter times staff insert" on public.session_participant_chapter_times;
create policy "chapter times staff insert"
on public.session_participant_chapter_times
for insert
to authenticated
with check (public.is_staff_console_user(50));

drop policy if exists "chapter times staff update" on public.session_participant_chapter_times;
create policy "chapter times staff update"
on public.session_participant_chapter_times
for update
to authenticated
using (public.is_staff_console_user(50))
with check (public.is_staff_console_user(50));

drop policy if exists "chapter times staff delete" on public.session_participant_chapter_times;
create policy "chapter times staff delete"
on public.session_participant_chapter_times
for delete
to authenticated
using (public.is_staff_console_user(50));

drop trigger if exists session_participant_chapter_times_set_updated_at on public.session_participant_chapter_times;
create trigger session_participant_chapter_times_set_updated_at
before update on public.session_participant_chapter_times
for each row execute function public.staff_set_updated_at();

create or replace function public.set_profile_stat_overrides(
  p_profile_id uuid,
  p_average_accuracy double precision default null,
  p_best_escape_duration_seconds integer default null,
  p_update_average_accuracy boolean default false,
  p_update_best_escape_duration boolean default false,
  p_total_projectiles integer default null,
  p_update_total_projectiles boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_average_accuracy double precision;
  v_old_best_escape_duration_seconds integer;
  v_old_total_projectiles integer;
  v_saved_average_accuracy double precision;
  v_saved_best_escape_duration_seconds integer;
  v_saved_total_projectiles integer;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_update_average_accuracy and p_average_accuracy is not null and (p_average_accuracy < 0 or p_average_accuracy > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_update_best_escape_duration and p_best_escape_duration_seconds is not null and p_best_escape_duration_seconds <= 0 then
    raise exception 'Best escape time must be greater than 0.';
  end if;

  if p_update_total_projectiles and p_total_projectiles is not null and p_total_projectiles < 0 then
    raise exception 'Shots must be zero or higher.';
  end if;

  select average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override
  into v_old_average_accuracy, v_old_best_escape_duration_seconds, v_old_total_projectiles
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set average_accuracy_override = case when p_update_average_accuracy then p_average_accuracy else average_accuracy_override end,
      best_escape_duration_seconds_override = case when p_update_best_escape_duration then p_best_escape_duration_seconds else best_escape_duration_seconds_override end,
      total_projectiles_override = case when p_update_total_projectiles then p_total_projectiles else total_projectiles_override end,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override
  into v_saved_average_accuracy, v_saved_best_escape_duration_seconds, v_saved_total_projectiles;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'profile_stat_overrides_updated',
      'profile',
      p_profile_id,
      jsonb_build_object(
        'average_accuracy_override', v_old_average_accuracy,
        'best_escape_duration_seconds_override', v_old_best_escape_duration_seconds,
        'total_projectiles_override', v_old_total_projectiles
      ),
      jsonb_build_object(
        'average_accuracy_override', v_saved_average_accuracy,
        'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds,
        'total_projectiles_override', v_saved_total_projectiles
      )
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'average_accuracy_override', v_saved_average_accuracy,
    'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds,
    'total_projectiles_override', v_saved_total_projectiles
  );
end;
$$;

revoke all on function public.set_profile_stat_overrides(uuid, double precision, integer, boolean, boolean, integer, boolean) from public, anon;
grant execute on function public.set_profile_stat_overrides(uuid, double precision, integer, boolean, boolean, integer, boolean) to authenticated, service_role;

create or replace function public.set_session_participant_chapter_time(
  p_participant_id uuid,
  p_game_slug text,
  p_chapter_number integer,
  p_duration_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_participant public.session_participants%rowtype;
  v_session public.sessions%rowtype;
  v_game public.staff_games%rowtype;
  v_saved public.session_participant_chapter_times%rowtype;
  v_normalized_game_slug text := lower(nullif(btrim(p_game_slug), ''));
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_participant_id is null then
    raise exception 'Participant id is required.';
  end if;

  if v_normalized_game_slug is null then
    raise exception 'Game is required.';
  end if;

  if p_chapter_number is null or p_chapter_number < 1 then
    raise exception 'Chapter number is required.';
  end if;

  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'Chapter time must be greater than 0.';
  end if;

  select *
  into v_participant
  from public.session_participants
  where id = p_participant_id
    and deleted_at is null;

  if not found then
    raise exception 'Participant not found.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = v_participant.session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  select *
  into v_game
  from public.staff_games
  where slug = v_normalized_game_slug
  limit 1;

  if found then
    if v_game.game_type <> 'escape' then
      raise exception 'Chapter times can only be saved for Escape games.';
    end if;

    if p_chapter_number > coalesce(v_game.escape_chapter_count, 1) then
      raise exception 'Chapter number is higher than this game allows.';
    end if;
  end if;

  insert into public.session_participant_chapter_times (
    session_id,
    participant_id,
    profile_id,
    staff_game_id,
    game_slug,
    chapter_number,
    duration_seconds,
    recorded_by
  )
  values (
    v_session.id,
    v_participant.id,
    v_participant.profile_id,
    case when v_game.id is null then null else v_game.id end,
    v_normalized_game_slug,
    p_chapter_number,
    p_duration_seconds,
    v_actor
  )
  on conflict (participant_id, game_slug, chapter_number)
  do update set
    duration_seconds = excluded.duration_seconds,
    recorded_by = excluded.recorded_by,
    updated_at = now()
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'session_id', v_saved.session_id,
    'participant_id', v_saved.participant_id,
    'profile_id', v_saved.profile_id,
    'game_slug', v_saved.game_slug,
    'chapter_number', v_saved.chapter_number,
    'duration_seconds', v_saved.duration_seconds
  );
end;
$$;

revoke all on function public.set_session_participant_chapter_time(uuid, text, integer, integer) from public, anon;
grant execute on function public.set_session_participant_chapter_time(uuid, text, integer, integer) to authenticated, service_role;

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_auth_email text := nullif(lower(auth.jwt() ->> 'email'), '');
begin
  if v_is_service_role then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_actor_rank < 100 then
      new.role := 'player';
      new.email := coalesce(v_auth_email, lower(nullif(new.email, '')));
      new.score_adjustment := 0;
      new.loyalty_points_total := 0;
      new.average_accuracy_override := null;
      new.best_escape_duration_seconds_override := null;
      new.total_projectiles_override := null;
      new.deleted_at := null;
      new.deleted_by := null;
      new.delete_reason := null;
      new.banned_at := null;
      new.banned_by := null;
      new.ban_reason := null;
      new.is_seed_demo := false;
      new.seed_batch := null;
    end if;

    return new;
  end if;

  if v_actor_rank < 50 and (
    new.score_adjustment is distinct from old.score_adjustment
    or new.loyalty_points_total is distinct from old.loyalty_points_total
    or new.average_accuracy_override is distinct from old.average_accuracy_override
    or new.best_escape_duration_seconds_override is distinct from old.best_escape_duration_seconds_override
    or new.total_projectiles_override is distinct from old.total_projectiles_override
  ) then
    raise exception 'Staff access required to change profile stats.';
  end if;

  if v_actor_rank < 100 and (
    new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.delete_reason is distinct from old.delete_reason
    or new.banned_at is distinct from old.banned_at
    or new.banned_by is distinct from old.banned_by
    or new.ban_reason is distinct from old.ban_reason
    or new.is_seed_demo is distinct from old.is_seed_demo
    or new.seed_batch is distinct from old.seed_batch
  ) then
    raise exception 'Admin access required to change protected profile fields.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_sensitive_fields() from public, anon, authenticated;
