-- Local-only core schema baseline for development database rebuilds.
--
-- Production already had these tables before this migration history was
-- exported. Keep this SQL outside supabase/migrations: it is structural only,
-- contains no production data, no seed users, and no e2e fixtures.

create temp table if not exists vrena_core_schema_baseline_state (
  should_apply_starter_access boolean not null
) on commit drop;

truncate table vrena_core_schema_baseline_state;

insert into vrena_core_schema_baseline_state (should_apply_starter_access)
values (
  not (
    to_regclass('public.profiles') is not null
    and to_regclass('public.sessions') is not null
    and to_regclass('public.session_participants') is not null
  )
);

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  full_name text,
  nickname text,
  email text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  role text not null default 'player',
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null and btrim(phone) <> '';

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null and btrim(email) <> '';

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  unique (club_id, profile_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  session_type text not null default 'game',
  name text not null,
  date date not null,
  start_time time not null,
  duration_minutes integer not null default 20,
  max_players integer not null default 8,
  arena_count integer not null default 1,
  game_options text[] not null default '{}'::text[],
  game_votes jsonb not null default '{}'::jsonb,
  confirmed_game_id text,
  visibility text not null default 'public',
  invite_code text,
  notes text,
  status text not null default 'open',
  tournament_format text,
  best_of integer not null default 1,
  rounds_per_match integer,
  require_payment boolean not null default false,
  qualification_rule text,
  custom_qualifiers integer,
  enable_third_place_match boolean not null default false,
  first_prize text,
  second_prize text,
  third_prize text,
  tournament_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_date_start_idx
  on public.sessions (date, start_time);

create index if not exists sessions_owner_idx
  on public.sessions (owner_id);

create index if not exists sessions_club_idx
  on public.sessions (club_id)
  where club_id is not null;

create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  checked_in boolean not null default false,
  payment_status text,
  payment_amount integer,
  score integer,
  accuracy_percent numeric,
  projectiles_fired integer,
  placement integer,
  prize_claimed boolean not null default false,
  prize_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

create index if not exists session_participants_session_idx
  on public.session_participants (session_id);

create index if not exists session_participants_profile_idx
  on public.session_participants (profile_id);

create table if not exists public.tournament_editors (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  created_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

create table if not exists public.tournament_pools (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_pool_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  pool_id uuid references public.tournament_pools(id) on delete cascade,
  participant_id uuid references public.session_participants(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  seed integer,
  team_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  pool_id uuid references public.tournament_pools(id) on delete set null,
  stage text not null default 'group',
  match_number integer not null default 1,
  participant_a_id uuid references public.session_participants(id) on delete set null,
  participant_b_id uuid references public.session_participants(id) on delete set null,
  profile_a_id uuid references public.profiles(id) on delete set null,
  profile_b_id uuid references public.profiles(id) on delete set null,
  score_a integer,
  score_b integer,
  winner_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  arenas_used integer not null default 1,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  check (arenas_used > 0)
);

create index if not exists blocked_times_date_time_idx
  on public.blocked_times (date, start_time, end_time);

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.tournament_editors enable row level security;
alter table public.tournament_pools enable row level security;
alter table public.tournament_pool_entries enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.blocked_times enable row level security;

do $$
declare
  v_should_apply boolean;
begin
  select should_apply_starter_access
  into v_should_apply
  from vrena_core_schema_baseline_state
  limit 1;

  if v_should_apply is not true then
    raise notice 'Core schema baseline starter grants and policies skipped because core tables already exist.';
    return;
  end if;

  grant usage on schema public to anon, authenticated, service_role;

  grant select on public.profiles, public.clubs, public.club_members, public.sessions, public.session_participants to anon;
  grant select, insert, update on public.profiles, public.clubs, public.club_members, public.sessions, public.session_participants to authenticated;
  grant select on public.tournament_editors, public.tournament_pools, public.tournament_pool_entries, public.tournament_matches, public.blocked_times to authenticated;
  grant insert, update, delete on public.tournament_editors, public.tournament_pools, public.tournament_pool_entries, public.tournament_matches, public.blocked_times to authenticated;
  grant all on public.profiles, public.clubs, public.club_members, public.sessions, public.session_participants, public.tournament_editors, public.tournament_pools, public.tournament_pool_entries, public.tournament_matches, public.blocked_times to service_role;

  create policy "Anyone can read profiles"
  on public.profiles
  for select
  using (true);

  create policy "Users insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

  create policy "Users update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

  create policy "clubs are readable"
  on public.clubs
  for select
  using (true);

  create policy "users create own clubs"
  on public.clubs
  for insert
  with check (auth.uid() = owner_id);

  create policy "club owners update clubs"
  on public.clubs
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

  create policy "club members readable by allowed users"
  on public.club_members
  for select
  using (true);

  create policy "users manage own club membership"
  on public.club_members
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

  create policy "sessions readable by allowed users"
  on public.sessions
  for select
  using (true);

  create policy "users create own sessions"
  on public.sessions
  for insert
  with check (auth.uid() = owner_id);

  create policy "session managers update sessions"
  on public.sessions
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

  create policy "session participants readable by allowed users"
  on public.session_participants
  for select
  using (true);

  create policy "users join sessions as themselves"
  on public.session_participants
  for insert
  with check (auth.uid() = profile_id);

  create policy "session managers update participant results"
  on public.session_participants
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

  create policy "tournament editors are readable"
  on public.tournament_editors
  for select
  using (true);

  create policy "tournament rows are readable"
  on public.tournament_pools
  for select
  using (true);

  create policy "tournament entries are readable"
  on public.tournament_pool_entries
  for select
  using (true);

  create policy "tournament matches are readable"
  on public.tournament_matches
  for select
  using (true);

  create policy "blocked times are readable"
  on public.blocked_times
  for select
  using (true);
end;
$$;
