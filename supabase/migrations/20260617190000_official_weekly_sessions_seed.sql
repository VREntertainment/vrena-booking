create or replace function public.vrena_seed_official_weekly_sessions(
  p_seed_batch text default 'official-weekly-vrena-2026-06-17'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_current_time time := (now() at time zone 'Asia/Ho_Chi_Minh')::time;
  v_fallback_phone text;
  v_updated integer := 0;
  v_inserted integer := 0;
  v_result jsonb := '{}'::jsonb;
begin
  select profiles.id
  into v_owner_id
  from public.profiles
  where lower(profiles.email) = 'contact@vre-vietnam.com'
  limit 1;

  if v_owner_id is null then
    select users.id
    into v_owner_id
    from auth.users
    where lower(users.email) = 'contact@vre-vietnam.com'
    limit 1;
  end if;

  if v_owner_id is null then
    raise exception 'contact@vre-vietnam.com was not found in auth.users or public.profiles. Create/log in that user before seeding official sessions.';
  end if;

  v_fallback_phone := '+84' || substring(regexp_replace(v_owner_id::text, '[^0-9]', '', 'g') || '0000000000' from 1 for 10);

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    role,
    updated_at
  ) values (
    v_owner_id,
    v_fallback_phone,
    'VRena Admin',
    'VRena',
    'contact@vre-vietnam.com',
    'admin',
    now()
  )
  on conflict (id) do update
  set role = 'admin',
      email = coalesce(nullif(public.profiles.email, ''), excluded.email),
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      nickname = coalesce(public.profiles.nickname, excluded.nickname),
      updated_at = now();

  create temp table if not exists vrena_official_weekly_schedule (
    sort_order integer primary key,
    day_name text not null,
    day_of_week integer not null,
    start_time time not null,
    name text not null,
    target text not null,
    game_options text[] not null,
    default_game text not null
  ) on commit drop;

  truncate table vrena_official_weekly_schedule;

  insert into vrena_official_weekly_schedule (
    sort_order,
    day_name,
    day_of_week,
    start_time,
    name,
    target,
    game_options,
    default_game
  ) values
    (1, 'Monday', 1, time '10:00', 'Morning VR Starter / Khởi Động VR Buổi Sáng', 'First-time players, quiet groups, tourists', array['laser-tag','mini-block-towers','snow-battle'], 'laser-tag'),
    (2, 'Monday', 1, time '18:30', 'First-Time Players / Lần Đầu Vào Game', 'New users, beginners, casual friends', array['laser-tag','snow-battle','paintball'], 'laser-tag'),
    (3, 'Monday', 1, time '20:00', 'Club Practice / Luyện Đội Club', 'Regular players, clubs, returning users', array['laser-tag','paintball','wild-west','office-war'], 'laser-tag'),
    (4, 'Tuesday', 2, time '10:00', 'Ladies Morning VR / VR Buổi Sáng Hội Bạn Gái', 'Ladies 35-45, premium social groups', array['joller-house','arc-of-the-covenant','snow-battle'], 'joller-house'),
    (5, 'Tuesday', 2, time '18:30', 'First-Time Players / Lần Đầu Vào Game', 'New users, students, casual groups', array['laser-tag','mini-block-towers','paintball'], 'laser-tag'),
    (6, 'Tuesday', 2, time '20:00', 'Ladies VR Night / Đêm VR Hội Bạn Gái', 'Ladies 35-45, after-work friends', array['laser-tag','snow-battle','joller-house'], 'laser-tag'),
    (7, 'Wednesday', 3, time '10:00', 'Student Group Slot / Suất Nhóm Học Sinh', 'Students, school groups, young players', array['laser-tag','mini-block-towers','paintball'], 'mini-block-towers'),
    (8, 'Wednesday', 3, time '18:30', 'Corporate Afterwork / Tan Làm Vào Trận', 'Office workers, team building, adults', array['office-war','paintball','laser-tag'], 'office-war'),
    (9, 'Wednesday', 3, time '20:00', 'First-Time Players / Lần Đầu Vào Game', 'Beginners, mixed groups, couples', array['laser-tag','snow-battle','joller-house'], 'laser-tag'),
    (10, 'Thursday', 4, time '10:00', 'Ladies Morning VR / VR Buổi Sáng Hội Bạn Gái', 'Ladies 35-45, relaxed premium groups', array['joller-house','arc-of-the-covenant','snow-battle'], 'joller-house'),
    (11, 'Thursday', 4, time '18:30', 'Ladies VR Night / Đêm VR Hội Bạn Gái', 'Ladies 35-45, friend groups', array['laser-tag','snow-battle','joller-house'], 'laser-tag'),
    (12, 'Thursday', 4, time '20:00', 'Team Challenge / Thử Thách Đồng Đội', 'Regular players, clubs, competitive groups', array['laser-tag','paintball','wild-west','castle-unspunnen'], 'paintball'),
    (13, 'Friday', 5, time '10:00', 'Birthday Squad / Biệt Đội Sinh Nhật', 'Birthday groups, private groups', array['laser-tag','paintball','snow-battle','joller-house'], 'laser-tag'),
    (14, 'Friday', 5, time '18:30', 'Birthday Squad / Biệt Đội Sinh Nhật', 'Celebration groups, friends, families', array['laser-tag','paintball','snow-battle','joller-house'], 'laser-tag'),
    (15, 'Friday', 5, time '20:30', 'Friday Night Battle / Đại Chiến Tối Thứ Sáu', 'Teenagers, young adults, competitive players', array['laser-tag','paintball','wild-west','office-war'], 'laser-tag'),
    (16, 'Saturday', 6, time '10:00', 'Family Morning Challenge / Thử Thách Gia Đình Buổi Sáng', 'Families, parents, kids, early mall visitors', array['snow-battle','mini-block-towers','laser-tag'], 'snow-battle'),
    (17, 'Saturday', 6, time '16:00', 'Family Challenge / Thử Thách Gia Đình', 'Families, mixed generations, casual groups', array['snow-battle','laser-tag','joller-house'], 'snow-battle'),
    (18, 'Saturday', 6, time '19:30', 'Social Battle / Đại Chiến Hội Bạn', 'Friends, birthdays, young adults', array['laser-tag','paintball','wild-west','snow-battle'], 'laser-tag'),
    (19, 'Sunday', 0, time '10:00', 'Family Morning Challenge / Thử Thách Gia Đình Buổi Sáng', 'Families, kids, relaxed groups', array['snow-battle','mini-block-towers','laser-tag'], 'snow-battle'),
    (20, 'Sunday', 0, time '16:00', 'Family Challenge / Thử Thách Gia Đình', 'Families, parents, teens', array['snow-battle','laser-tag','joller-house'], 'snow-battle'),
    (21, 'Sunday', 0, time '18:00', 'Easy Social Game / Vào Trận Vui Vẻ', 'Beginners, casual groups, people preparing for Monday', array['laser-tag','snow-battle','joller-house'], 'laser-tag');

  create temp table if not exists vrena_official_weekly_occurrences (
    sort_order integer not null,
    occurrence_date date not null,
    start_time time not null,
    name text not null,
    notes text not null,
    game_options text[] not null,
    default_game text not null,
    primary key (sort_order, occurrence_date)
  ) on commit drop;

  truncate table vrena_official_weekly_occurrences;

  insert into vrena_official_weekly_occurrences (
    sort_order,
    occurrence_date,
    start_time,
    name,
    notes,
    game_options,
    default_game
  )
  select
    schedule.sort_order,
    v_today
      + (
        ((schedule.day_of_week - extract(dow from v_today)::integer + 7) % 7)
        + case
          when ((schedule.day_of_week - extract(dow from v_today)::integer + 7) % 7) = 0
            and schedule.start_time <= v_current_time
          then 7
          else 0
        end
        + (week_index * 7)
      ),
    schedule.start_time,
    schedule.name,
    '<p><strong>Official VRena community session.</strong></p>'
      || '<p>Schedule: ' || schedule.day_name || ' ' || to_char(schedule.start_time, 'HH24:MI') || '.</p>'
      || '<p>Best for: ' || schedule.target || '.</p>'
      || '<p>Join the table, vote the game, and pay onsite at reception.</p>',
    schedule.game_options,
    schedule.default_game
  from vrena_official_weekly_schedule schedule
  cross join generate_series(0, 3) as week_index;

  update public.sessions existing
  set owner_id = v_owner_id,
      club_id = null,
      session_type = 'game',
      duration_minutes = 40,
      max_players = 16,
      arena_count = 2,
      game_options = occurrences.game_options,
      game_votes = jsonb_build_object(v_owner_id::text, occurrences.default_game),
      confirmed_game_id = null,
      visibility = 'public',
      invite_code = null,
      notes = occurrences.notes,
      status = 'open',
      tournament_format = null,
      best_of = 1,
      rounds_per_match = null,
      require_payment = false,
      qualification_rule = null,
      custom_qualifiers = null,
      enable_third_place_match = false,
      first_prize = null,
      second_prize = null,
      third_prize = null,
      tournament_locked = false,
      seeded = true,
      seed_batch = p_seed_batch,
      seed_label = 'Official VRena',
      seeded_at = coalesce(existing.seeded_at, now()),
      booking_type = 'community',
      ticket_type = null,
      ticket_player_count = null,
      ticket_unit_price = null,
      ticket_total_price = null,
      ticket_status = null,
      ticket_reference = null,
      ticket_customer_id = null
  from vrena_official_weekly_occurrences occurrences
  where existing.seeded is true
    and existing.seed_batch = p_seed_batch
    and existing.date = occurrences.occurrence_date
    and existing.start_time = occurrences.start_time
    and existing.name = occurrences.name;
  get diagnostics v_updated = row_count;

  insert into public.sessions (
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
    seeded_at,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  )
  select
    v_owner_id,
    null,
    'game',
    occurrences.name,
    occurrences.occurrence_date,
    occurrences.start_time,
    40,
    16,
    2,
    occurrences.game_options,
    jsonb_build_object(v_owner_id::text, occurrences.default_game),
    null,
    'public',
    null,
    occurrences.notes,
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    true,
    p_seed_batch,
    'Official VRena',
    now(),
    'community',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  from vrena_official_weekly_occurrences occurrences
  where not exists (
    select 1
    from public.sessions existing
    where existing.seeded is true
      and existing.seed_batch = p_seed_batch
      and existing.date = occurrences.occurrence_date
      and existing.start_time = occurrences.start_time
      and existing.name = occurrences.name
  );
  get diagnostics v_inserted = row_count;

  v_result := jsonb_build_object(
    'admin_profile_id', v_owner_id,
    'admin_email', 'contact@vre-vietnam.com',
    'seed_batch', p_seed_batch,
    'official_sessions_updated', v_updated,
    'official_sessions_inserted', v_inserted
  );

  raise notice 'VRena official weekly sessions seed complete: %', v_result;
  return v_result;
end;
$$;

create or replace function public.is_vrena_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and (
        profiles.role = 'admin'
        or lower(profiles.email) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com')
      )
  );
$$;

revoke all on function public.is_vrena_admin() from public;
grant execute on function public.is_vrena_admin() to authenticated, service_role;

revoke all on function public.vrena_seed_official_weekly_sessions(text) from public, anon, authenticated;
grant execute on function public.vrena_seed_official_weekly_sessions(text) to service_role;

select public.vrena_seed_official_weekly_sessions();
