alter table public.sessions
  add column if not exists booking_type text not null default 'community',
  add column if not exists ticket_type text,
  add column if not exists ticket_player_count integer,
  add column if not exists ticket_unit_price integer,
  add column if not exists ticket_total_price integer,
  add column if not exists ticket_status text,
  add column if not exists ticket_reference text,
  add column if not exists ticket_customer_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sessions_booking_type_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_booking_type_check
      check (booking_type in ('community', 'ticket'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sessions_ticket_type_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_ticket_type_check
      check (ticket_type is null or ticket_type in ('individual', 'birthday', 'corporate'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sessions_ticket_status_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_ticket_status_check
      check (ticket_status is null or ticket_status in ('pending', 'confirmed', 'cancelled', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sessions_ticket_customer_id_fkey'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_ticket_customer_id_fkey
      foreign key (ticket_customer_id) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists sessions_booking_type_date_idx
on public.sessions (booking_type, date, start_time);

create index if not exists sessions_ticket_customer_idx
on public.sessions (ticket_customer_id)
where booking_type = 'ticket';

create unique index if not exists sessions_ticket_reference_unique_idx
on public.sessions (ticket_reference)
where ticket_reference is not null;

create or replace function public.create_ticket_booking(
  p_ticket_type text,
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_player_count integer,
  p_arena_count integer,
  p_game_options text[],
  p_unit_price integer,
  p_total_price integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_session_id uuid;
  v_ticket_reference text;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_game_options text[] := coalesce(nullif(p_game_options, array[]::text[]), array['laser-tag']);
  v_default_game text;
begin
  if v_user_id is null then
    raise exception 'Login required to book tickets.';
  end if;

  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_player_count < 1 or p_player_count > 16 then
    raise exception 'Invalid player count.';
  end if;

  if p_arena_count < 1 or p_arena_count > 2 then
    raise exception 'Invalid arena count.';
  end if;

  if p_unit_price < 0 or p_total_price < 0 then
    raise exception 'Invalid ticket price.';
  end if;

  if p_ticket_type = 'individual' and p_total_price <> p_unit_price * p_player_count then
    raise exception 'Ticket price does not match the selected player count.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile required to book tickets.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if (p_date + p_start_time) <= now() then
    raise exception 'Selected time is already past.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where date = p_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_start_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where date = p_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_start_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < p_arena_count then
    raise exception 'Selected time slot is no longer available.';
  end if;

  v_default_game := coalesce(v_game_options[1], 'laser-tag');
  v_ticket_reference := 'TKT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

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
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  ) values (
    v_user_id,
    null,
    'game',
    'Ticket booking - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    p_arena_count,
    v_game_options,
    jsonb_build_object(v_user_id::text, v_default_game),
    v_default_game,
    'private',
    v_invite_code,
    'Private ticket booking',
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
    'ticket',
    p_ticket_type,
    p_player_count,
    p_unit_price,
    p_total_price,
    'confirmed',
    v_ticket_reference,
    v_user_id
  )
  returning id into v_session_id;

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
    payment_amount
  ) values (
    v_session_id,
    v_user_id,
    coalesce(v_profile.nickname, v_profile.full_name, v_profile.phone, 'Player'),
    v_profile.avatar_url,
    v_profile.avatar_emoji,
    v_profile.avatar_initials,
    v_profile.avatar_color,
    v_profile.avatar_text_color,
    v_profile.profile_motto,
    p_total_price
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'confirmed'
  );
end;
$$;

revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) from public, anon;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer) to authenticated;
