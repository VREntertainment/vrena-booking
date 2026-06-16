alter table public.sessions
  add column if not exists seeded boolean not null default false,
  add column if not exists seed_batch text,
  add column if not exists seed_label text,
  add column if not exists seeded_at timestamptz;

alter table public.profiles
  add column if not exists is_seed_demo boolean not null default false,
  add column if not exists seed_batch text;

create index if not exists sessions_seeded_batch_idx
on public.sessions (seeded, seed_batch);

create index if not exists profiles_seed_demo_batch_idx
on public.profiles (is_seed_demo, seed_batch);

create or replace function public.vrena_delete_session_scoped_rows(
  p_table_name text,
  p_session_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_session_ids is null or cardinality(p_session_ids) = 0 then
    return 0;
  end if;

  if to_regclass(format('public.%I', p_table_name)) is null then
    return 0;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table_name
      and column_name = 'session_id'
  ) then
    return 0;
  end if;

  execute format('delete from public.%I where session_id = any ($1)', p_table_name)
  using p_session_ids;
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all on function public.vrena_delete_session_scoped_rows(text, uuid[]) from public, anon, authenticated;

create or replace function public.vrena_soft_launch_reset_seed(
  p_allow_production_seed boolean default false,
  p_seed_batch text default 'soft-launch-2026-06-16'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_ids uuid[] := '{}'::uuid[];
  v_known_tables text[] := array[
    'session_invites',
    'session_messages',
    'session_waitlist',
    'tournament_audit_log',
    'tournament_matches',
    'tournament_pool_entries',
    'tournament_pools',
    'tournament_editors',
    'session_participants'
  ];
  v_table text;
  v_deleted integer := 0;
  v_result jsonb := '{}'::jsonb;
  v_seeded_sessions integer := 0;
  v_seeded_participants integer := 0;
  v_seeded_comments integer := 0;
  v_seeded_profiles integer := 0;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch reset refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  if to_regclass('public.sessions') is null then
    raise exception 'Missing required table public.sessions.';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'Missing required table public.profiles.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_session_ids
  from public.sessions;

  foreach v_table in array v_known_tables loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  for v_table in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'session_id'
      and c.table_name <> 'sessions'
      and c.table_name <> all(v_known_tables)
    order by c.table_name
  loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  delete from public.sessions;
  get diagnostics v_deleted = row_count;
  v_result := v_result || jsonb_build_object('deleted_sessions', v_deleted);

  drop table if exists pg_temp.vrena_seed_profiles;
  create temp table vrena_seed_profiles (
    id uuid primary key,
    phone text not null,
    full_name text not null,
    nickname text not null,
    email text not null,
    avatar_emoji text,
    avatar_initials text,
    avatar_color text not null,
    avatar_text_color text not null,
    profile_motto text
  ) on commit drop;

  insert into vrena_seed_profiles values
    ('00000000-0000-4000-8000-000000000101', '+84000000101', 'VRena Rookie', 'Rookie', 'softlaunch-rookie@vrena.demo', '😎', 'VR', '#3059ff', '#ffffff', 'First quest'),
    ('00000000-0000-4000-8000-000000000102', '+84000000102', 'Ha Do Hunter', 'Ha Do', 'softlaunch-hado@vrena.demo', '🎯', 'HD', '#12b6b0', '#071112', 'Calm aim'),
    ('00000000-0000-4000-8000-000000000103', '+84000000103', 'Neon Noodle', 'Neon', 'softlaunch-neon@vrena.demo', '⚡', 'NN', '#7c3aed', '#ffffff', 'Fast feet'),
    ('00000000-0000-4000-8000-000000000104', '+84000000104', 'Byte Bender', 'Byte', 'softlaunch-byte@vrena.demo', '🕹️', 'BB', '#0ea5e9', '#071112', 'Map brain'),
    ('00000000-0000-4000-8000-000000000105', '+84000000105', 'Saigon Spark', 'Saigon', 'softlaunch-saigon@vrena.demo', '✨', 'SS', '#f59e0b', '#071112', 'One more'),
    ('00000000-0000-4000-8000-000000000106', '+84000000106', 'Arena Ace', 'Ace', 'softlaunch-ace@vrena.demo', '🏅', 'AA', '#16a34a', '#ffffff', 'No panic'),
    ('00000000-0000-4000-8000-000000000107', '+84000000107', 'Joller Runner', 'Joller', 'softlaunch-joller@vrena.demo', '🚪', 'JR', '#dc2626', '#ffffff', 'Exit found'),
    ('00000000-0000-4000-8000-000000000108', '+84000000108', 'Arc Whisper', 'Arc', 'softlaunch-arc@vrena.demo', '🧩', 'AW', '#0891b2', '#ffffff', 'Puzzle mode'),
    ('00000000-0000-4000-8000-000000000109', '+84000000109', 'Paint Pop', 'Paint', 'softlaunch-paint@vrena.demo', '🎨', 'PP', '#db2777', '#ffffff', 'Bright hits'),
    ('00000000-0000-4000-8000-000000000110', '+84000000110', 'Snow Slider', 'Snow', 'softlaunch-snow@vrena.demo', '❄️', 'SL', '#38bdf8', '#071112', 'Stay cool'),
    ('00000000-0000-4000-8000-000000000111', '+84000000111', 'Office Ninja', 'Office', 'softlaunch-office@vrena.demo', '☕', 'ON', '#64748b', '#ffffff', 'Desk dodge'),
    ('00000000-0000-4000-8000-000000000112', '+84000000112', 'Crown Chaser', 'Crown', 'softlaunch-crown@vrena.demo', '👑', 'CC', '#facc15', '#071112', 'Top shelf');

  if exists (
    select 1
    from public.profiles p
    join vrena_seed_profiles sp on sp.id = p.id
    where p.is_seed_demo is false
  ) then
    raise exception 'A seed profile UUID already belongs to a non-demo profile. Aborting without modifying profiles.';
  end if;

  if exists (
    select 1
    from public.profiles p
    join vrena_seed_profiles sp on lower(p.email) = lower(sp.email)
    where p.id <> sp.id
  ) then
    raise exception 'A soft-launch demo email is already used by another profile. Aborting without modifying profiles.';
  end if;

  if exists (
    select 1
    from public.profiles p
    join vrena_seed_profiles sp on p.phone = sp.phone
    where p.id <> sp.id
  ) then
    raise exception 'A soft-launch demo phone is already used by another profile. Aborting without modifying profiles.';
  end if;

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    role,
    score_adjustment,
    is_seed_demo,
    seed_batch
  )
  select
    id,
    phone,
    full_name,
    nickname,
    email,
    null,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    'player',
    0,
    true,
    p_seed_batch
  from vrena_seed_profiles
  on conflict (id) do update
  set phone = excluded.phone,
      full_name = excluded.full_name,
      nickname = excluded.nickname,
      email = excluded.email,
      avatar_url = excluded.avatar_url,
      avatar_emoji = excluded.avatar_emoji,
      avatar_initials = excluded.avatar_initials,
      avatar_color = excluded.avatar_color,
      avatar_text_color = excluded.avatar_text_color,
      profile_motto = excluded.profile_motto,
      role = excluded.role,
      score_adjustment = excluded.score_adjustment,
      is_seed_demo = true,
      seed_batch = excluded.seed_batch
  where public.profiles.is_seed_demo = true;
  get diagnostics v_seeded_profiles = row_count;

  drop table if exists pg_temp.vrena_seed_sessions;
  create temp table vrena_seed_sessions (
    id uuid primary key,
    owner_id uuid not null,
    session_type text not null,
    name text not null,
    date_offset integer not null,
    start_time time not null,
    duration_minutes integer not null,
    max_players integer not null,
    arena_count integer not null,
    game_options text[] not null,
    game_votes jsonb not null,
    confirmed_game_id text not null,
    visibility text not null,
    invite_code text,
    notes text,
    tournament_format text,
    best_of integer,
    rounds_per_match integer,
    require_payment boolean,
    qualification_rule text,
    custom_qualifiers integer,
    enable_third_place_match boolean,
    first_prize text,
    second_prize text,
    third_prize text,
    tournament_locked boolean
  ) on commit drop;

  insert into vrena_seed_sessions values
    ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000101', 'game', 'Neon Noodle Warmup', 13, time '18:20', 40, 8, 1, array['laser-tag'], '{"00000000-0000-4000-8000-000000000101":"laser-tag","00000000-0000-4000-8000-000000000103":"laser-tag","00000000-0000-4000-8000-000000000106":"laser-tag"}'::jsonb, 'laser-tag', 'public', null, 'Soft Opening Highlights: quick warmup, bright scoreboard, zero pressure.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000107', 'game', 'Joller House Exit Crew', 12, time '19:00', 40, 6, 1, array['joller-house'], '{"00000000-0000-4000-8000-000000000107":"joller-house","00000000-0000-4000-8000-000000000108":"joller-house"}'::jsonb, 'joller-house', 'private', 'JOLLER', 'Soft Opening Highlights: small escape crew, big hallway theories.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000111', 'game', 'Office War Coffee Raid', 10, time '17:40', 40, 8, 1, array['office-war'], '{"00000000-0000-4000-8000-000000000111":"office-war","00000000-0000-4000-8000-000000000104":"office-war"}'::jsonb, 'office-war', 'public', null, 'Soft Opening Highlights: desk cover, fast laughs, suspicious coffee energy.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000102', 'game', 'Wild West Quickdraw Circus', 9, time '20:00', 40, 8, 1, array['wild-west'], '{"00000000-0000-4000-8000-000000000102":"wild-west","00000000-0000-4000-8000-000000000112":"wild-west"}'::jsonb, 'wild-west', 'private', 'DRAW77', 'Soft Opening Highlights: quickdraw practice with a very loud scoreboard.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000110', 'game', 'Snow Battle Freeze Tag', 7, time '18:40', 40, 8, 1, array['snow-battle'], '{"00000000-0000-4000-8000-000000000110":"snow-battle","00000000-0000-4000-8000-000000000103":"snow-battle"}'::jsonb, 'snow-battle', 'public', null, 'Soft Opening Highlights: cool hands, warm rematch energy.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000109', 'game', 'Paintball Chaos Practice', 6, time '19:20', 60, 10, 2, array['paintball'], '{"00000000-0000-4000-8000-000000000109":"paintball","00000000-0000-4000-8000-000000000110":"paintball"}'::jsonb, 'paintball', 'public', null, 'Soft Opening Highlights: two arenas, bright hits, tidy chaos.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001007', '00000000-0000-4000-8000-000000000108', 'game', 'Arc Vault Brain Run', 5, time '18:00', 40, 5, 1, array['arc-of-the-covenant'], '{"00000000-0000-4000-8000-000000000108":"arc-of-the-covenant","00000000-0000-4000-8000-000000000112":"arc-of-the-covenant"}'::jsonb, 'arc-of-the-covenant', 'private', 'ARC555', 'Soft Opening Highlights: clues, guesses, and one heroic shortcut.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000000104', 'game', 'Mini Block Tower Tilt', 3, time '17:20', 40, 6, 1, array['mini-block-towers'], '{"00000000-0000-4000-8000-000000000104":"mini-block-towers","00000000-0000-4000-8000-000000000105":"mini-block-towers"}'::jsonb, 'mini-block-towers', 'public', null, 'Soft Opening Highlights: compact map, big scoreboard swings.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001009', '00000000-0000-4000-8000-000000000106', 'game', 'Castle Unspunnen Shield Run', 2, time '20:20', 40, 8, 1, array['castle-unspunnen'], '{"00000000-0000-4000-8000-000000000106":"castle-unspunnen","00000000-0000-4000-8000-000000000112":"castle-unspunnen"}'::jsonb, 'castle-unspunnen', 'public', null, 'Soft Opening Highlights: careful corners, bold pushes, clean finish.', null, 1, null, false, null, null, false, null, null, null, false),
    ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000000112', 'tournament', 'VRena Crown Scramble', 1, time '18:00', 60, 8, 2, array['laser-tag','paintball'], '{"00000000-0000-4000-8000-000000000112":"laser-tag","00000000-0000-4000-8000-000000000103":"paintball","00000000-0000-4000-8000-000000000102":"laser-tag"}'::jsonb, 'laser-tag', 'public', null, 'Soft Opening Highlights: a compact tournament board for new players to understand the flow.', 'pool_to_final', 3, 1, false, 'top_1', 2, true, 'Free session', 'VRena drink', 'Sticker pack', true);

  insert into public.sessions (
    id,
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    seeded,
    seed_batch,
    seed_label,
    seeded_at
  )
  select
    id,
    owner_id,
    null,
    session_type,
    name,
    current_date - date_offset,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    'completed',
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    true,
    p_seed_batch,
    'Soft Opening Highlights',
    now()
  from vrena_seed_sessions;
  get diagnostics v_seeded_sessions = row_count;

  drop table if exists pg_temp.vrena_seed_participants;
  create temp table vrena_seed_participants (
    session_id uuid not null,
    profile_id uuid not null,
    score integer not null,
    accuracy_percent integer not null,
    projectiles_fired integer not null,
    placement integer,
    payment_status text not null,
    payment_amount numeric not null
  ) on commit drop;

  insert into vrena_seed_participants values
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000103',710,42,1180,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000106',580,34,910,2,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000101',620,38,1040,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000104',540,31,880,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000102',480,29,790,null,'free',0),
    ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000109',390,24,650,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000101',390,18,120,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000107',360,16,105,2,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000108',330,14,94,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000110',300,12,82,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000111',660,39,1110,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000105',610,35,980,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000104',570,33,930,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000103',520,28,840,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000102',450,25,760,null,'free',0),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000102',740,44,1210,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000112',690,41,1130,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000106',620,37,1000,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000101',590,35,950,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000107',510,30,870,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000111',430,26,720,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000110',700,40,1090,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000103',640,36,1015,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000105',530,32,900,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000109',450,27,780,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000108',410,24,700,null,'free',0),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000109',820,47,1390,1,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000110',690,39,1160,2,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000102',610,36,1080,3,'bank_transfer',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000111',580,34,1010,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000101',550,32,950,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000106',505,30,880,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000104',470,28,840,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000107',430,25,760,null,'free',0),
    ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000108',520,21,160,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000112',450,18,145,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000103',410,16,132,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000104',730,43,1220,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000105',680,40,1110,2,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000111',500,29,840,3,'cash',220000),
    ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000101',460,27,760,null,'free',0),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000106',760,45,1260,1,'cash',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000112',700,42,1170,2,'cash',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000107',610,36,990,3,'bank_transfer',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000110',590,34,940,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000109',555,32,900,null,'cash',220000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000112',900,51,1510,1,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000103',750,44,1320,2,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000104',710,41,1240,3,'bank_transfer',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000102',680,39,1200,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000106',640,37,1130,null,'cash',320000),
    ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000101',520,30,920,null,'free',0);

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    checked_in,
    payment_status,
    payment_amount,
    score,
    accuracy_percent,
    projectiles_fired,
    placement
  )
  select
    sp.session_id,
    sp.profile_id,
    p.nickname,
    null,
    p.avatar_emoji,
    p.avatar_initials,
    p.avatar_color,
    p.avatar_text_color,
    p.profile_motto,
    true,
    sp.payment_status,
    sp.payment_amount,
    sp.score,
    sp.accuracy_percent,
    sp.projectiles_fired,
    sp.placement
  from vrena_seed_participants sp
  join vrena_seed_profiles p on p.id = sp.profile_id;
  get diagnostics v_seeded_participants = row_count;

  if to_regclass('public.tournament_pools') is not null then
    insert into public.tournament_pools (session_id, name, sort_order) values
      ('00000000-0000-4000-8000-000000001010', 'Pool A', 1),
      ('00000000-0000-4000-8000-000000001010', 'Pool B', 2);
  end if;

  if to_regclass('public.tournament_pool_entries') is not null and to_regclass('public.tournament_pools') is not null then
    insert into public.tournament_pool_entries (session_id, pool_id, participant_id, profile_id, seed, team_label)
    select
      '00000000-0000-4000-8000-000000001010',
      pool.id,
      participant.id,
      seed.profile_id,
      seed.seed,
      seed.team_label
    from (
      values
        ('Pool A', '00000000-0000-4000-8000-000000000112'::uuid, 1, 'Team Crown'),
        ('Pool A', '00000000-0000-4000-8000-000000000104'::uuid, 2, 'Team Byte'),
        ('Pool A', '00000000-0000-4000-8000-000000000106'::uuid, 3, 'Team Ace'),
        ('Pool B', '00000000-0000-4000-8000-000000000103'::uuid, 1, 'Team Neon'),
        ('Pool B', '00000000-0000-4000-8000-000000000102'::uuid, 2, 'Team Ha Do'),
        ('Pool B', '00000000-0000-4000-8000-000000000101'::uuid, 3, 'Team Rookie')
    ) as seed(pool_name, profile_id, seed, team_label)
    join public.tournament_pools pool
      on pool.session_id = '00000000-0000-4000-8000-000000001010'
      and pool.name = seed.pool_name
    join public.session_participants participant
      on participant.session_id = '00000000-0000-4000-8000-000000001010'
      and participant.profile_id = seed.profile_id;
  end if;

  if to_regclass('public.tournament_matches') is not null and to_regclass('public.tournament_pools') is not null then
    insert into public.tournament_matches (
      session_id,
      pool_id,
      stage,
      round,
      match_number,
      participant_a_id,
      participant_b_id,
      score_a,
      score_b,
      wins_a,
      wins_b,
      winner_participant_id,
      loser_participant_id,
      status,
      arena_number,
      queue_position,
      best_of
    )
    select
      '00000000-0000-4000-8000-000000001010',
      pool.id,
      match.stage,
      match.round,
      match.match_number,
      pa.id,
      pb.id,
      match.score_a,
      match.score_b,
      match.wins_a,
      match.wins_b,
      case when match.winner_profile_id = match.profile_a_id then pa.id else pb.id end,
      case when match.winner_profile_id = match.profile_a_id then pb.id else pa.id end,
      'completed',
      match.arena_number,
      match.queue_position,
      3
    from (
      values
        ('Pool A', 'pool', 1, 1, '00000000-0000-4000-8000-000000000112'::uuid, '00000000-0000-4000-8000-000000000104'::uuid, '00000000-0000-4000-8000-000000000112'::uuid, 12, 8, 2, 1, 1, 1),
        ('Pool A', 'pool', 1, 2, '00000000-0000-4000-8000-000000000112'::uuid, '00000000-0000-4000-8000-000000000106'::uuid, '00000000-0000-4000-8000-000000000112'::uuid, 13, 7, 2, 0, 2, 2),
        ('Pool A', 'pool', 1, 3, '00000000-0000-4000-8000-000000000104'::uuid, '00000000-0000-4000-8000-000000000106'::uuid, '00000000-0000-4000-8000-000000000104'::uuid, 10, 9, 2, 1, 1, 3),
        ('Pool B', 'pool', 1, 4, '00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, 11, 9, 2, 1, 2, 4),
        ('Pool B', 'pool', 1, 5, '00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, 12, 6, 2, 0, 1, 5),
        ('Pool B', 'pool', 1, 6, '00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, 10, 8, 2, 1, 2, 6),
        ('Pool A', 'final', 2, 1, '00000000-0000-4000-8000-000000000112'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-4000-8000-000000000112'::uuid, 15, 12, 2, 1, 1, 7)
    ) as match(pool_name, stage, round, match_number, profile_a_id, profile_b_id, winner_profile_id, score_a, score_b, wins_a, wins_b, arena_number, queue_position)
    left join public.tournament_pools pool
      on pool.session_id = '00000000-0000-4000-8000-000000001010'
      and pool.name = match.pool_name
      and match.stage = 'pool'
    join public.session_participants pa
      on pa.session_id = '00000000-0000-4000-8000-000000001010'
      and pa.profile_id = match.profile_a_id
    join public.session_participants pb
      on pb.session_id = '00000000-0000-4000-8000-000000001010'
      and pb.profile_id = match.profile_b_id;
  end if;

  if to_regclass('public.tournament_audit_log') is not null then
    insert into public.tournament_audit_log (session_id, user_id, action, old_value, new_value, created_at)
    values (
      '00000000-0000-4000-8000-000000001010',
      '00000000-0000-4000-8000-000000000112',
      'Soft launch tournament seeded',
      null,
      jsonb_build_object('seed_batch', p_seed_batch, 'label', 'Soft Opening Highlights'),
      now()
    );
  end if;

  if to_regclass('public.session_messages') is not null then
    drop table if exists pg_temp.vrena_seed_comments;
    create temp table vrena_seed_comments (
      session_id uuid not null,
      author_id uuid not null,
      message_type text not null,
      body text not null,
      minute_offset integer not null
    ) on commit drop;

    insert into vrena_seed_comments values
      ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000101','announcement','Soft opening run: quick warmup, then swap teams after round two.',2),
      ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000103','comment','That last corner got busy fast.',18),
      ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000106','comment','Next time I am watching the left lane.',31),
      ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000107','announcement','Small escape crew tonight. Keep clues in the room and theories on the table.',1),
      ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000108','comment','The cabinet clue finally made sense at the end.',17),
      ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000110','comment','I wrote down the wrong number twice. Still fun.',33),
      ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000111','announcement','Coffee Raid starts on time. Winner buys nothing, just brags quietly.',3),
      ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000104','comment','Desk cover saved me for about four seconds.',19),
      ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000105','comment','Good pace. My aim arrived late.',35),
      ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000102','announcement','Private quickdraw night. Rotate after every two rounds.',4),
      ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000112','comment','The scoreboard was a little too honest.',24),
      ('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000106','comment','Rematch noted. I need one calmer first round.',38),
      ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000110','announcement','Freeze Tag flow: short rounds, quick reset, no long speeches.',2),
      ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000103','comment','The second round was all timing.',16),
      ('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000105','comment','I kept sliding past my own plan.',29),
      ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000109','announcement','Two arenas open. Keep teams moving and call breaks early.',1),
      ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000110','comment','Arena two felt faster today.',21),
      ('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000102','comment','Good teams. Paintball got spicy without getting messy.',44),
      ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000108','announcement','Vault run: talk through clues before touching everything at once.',2),
      ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000112','comment','That shortcut felt illegal but apparently worked.',15),
      ('00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000000103','comment','I had the right clue and the wrong confidence.',31),
      ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000104','announcement','Mini Block night. Compact map, fast swaps, tiny drama.',2),
      ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000105','comment','That tower angle was better than expected.',18),
      ('00000000-0000-4000-8000-000000001008','00000000-0000-4000-8000-000000000101','comment','I need a slower first minute next time.',34),
      ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000106','announcement','Shield Run starts with practice shots, then full pace.',3),
      ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000107','comment','The last push was clean.',20),
      ('00000000-0000-4000-8000-000000001009','00000000-0000-4000-8000-000000000109','comment','I got caught looking at the wrong doorway.',32),
      ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000112','announcement','Crown Scramble bracket is seeded. Pool winners go straight to final.',2),
      ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000103','comment','Pool B was closer than the scores make it look.',36),
      ('00000000-0000-4000-8000-000000001010','00000000-0000-4000-8000-000000000104','comment','Final had real noise from the sideline.',58);

    insert into public.session_messages (
      session_id,
      author_id,
      author_display_name,
      author_avatar_url,
      author_avatar_emoji,
      author_avatar_initials,
      author_avatar_color,
      author_avatar_text_color,
      author_profile_motto,
      message_type,
      body,
      moderation_status,
      moderation_reason,
      moderation_categories,
      moderation_score,
      created_at
    )
    select
      sc.session_id,
      sc.author_id,
      p.nickname,
      null,
      p.avatar_emoji,
      p.avatar_initials,
      p.avatar_color,
      p.avatar_text_color,
      p.profile_motto,
      sc.message_type,
      sc.body,
      'approved',
      null,
      '{}'::jsonb,
      0,
      (current_date - ss.date_offset) + ss.start_time + (sc.minute_offset || ' minutes')::interval
    from vrena_seed_comments sc
    join vrena_seed_profiles p on p.id = sc.author_id
    join vrena_seed_sessions ss on ss.id = sc.session_id;
    get diagnostics v_seeded_comments = row_count;
  end if;

  v_result := v_result
    || jsonb_build_object('seeded_profiles_upserted', v_seeded_profiles)
    || jsonb_build_object('seeded_sessions', v_seeded_sessions)
    || jsonb_build_object('seeded_participants', v_seeded_participants)
    || jsonb_build_object('seeded_comments', v_seeded_comments)
    || jsonb_build_object('seed_batch', p_seed_batch)
    || jsonb_build_object('label', 'Soft Opening Highlights');

  return v_result;
end;
$$;

revoke all on function public.vrena_soft_launch_reset_seed(boolean, text) from public, anon, authenticated;
grant execute on function public.vrena_soft_launch_reset_seed(boolean, text) to service_role;

create or replace function public.vrena_soft_launch_rollback_seed(
  p_allow_production_seed boolean default false,
  p_seed_batch text default 'soft-launch-2026-06-16'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_ids uuid[] := '{}'::uuid[];
  v_known_tables text[] := array[
    'session_invites',
    'session_messages',
    'session_waitlist',
    'tournament_audit_log',
    'tournament_matches',
    'tournament_pool_entries',
    'tournament_pools',
    'tournament_editors',
    'session_participants'
  ];
  v_table text;
  v_deleted integer := 0;
  v_result jsonb := '{}'::jsonb;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch rollback refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_session_ids
  from public.sessions
  where seeded is true
    and seed_batch = p_seed_batch;

  foreach v_table in array v_known_tables loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  for v_table in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'session_id'
      and c.table_name <> 'sessions'
      and c.table_name <> all(v_known_tables)
    order by c.table_name
  loop
    v_deleted := public.vrena_delete_session_scoped_rows(v_table, v_session_ids);
    v_result := v_result || jsonb_build_object('deleted_' || v_table, v_deleted);
  end loop;

  delete from public.sessions
  where seeded is true
    and seed_batch = p_seed_batch;
  get diagnostics v_deleted = row_count;

  return v_result
    || jsonb_build_object('deleted_sessions', v_deleted)
    || jsonb_build_object('seed_batch', p_seed_batch)
    || jsonb_build_object('demo_profiles_retained', (
      select count(*)
      from public.profiles
      where is_seed_demo is true
        and seed_batch = p_seed_batch
    ));
end;
$$;

revoke all on function public.vrena_soft_launch_rollback_seed(boolean, text) from public, anon, authenticated;
grant execute on function public.vrena_soft_launch_rollback_seed(boolean, text) to service_role;
