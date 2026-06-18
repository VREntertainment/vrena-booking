-- Add invite-only friend challenges as a lightweight session booking type.

alter table public.sessions
  add column if not exists challenge_target_id uuid,
  add column if not exists challenge_status text,
  add column if not exists challenge_accepted_at timestamptz,
  add column if not exists challenge_declined_at timestamptz;

alter table public.sessions
  drop constraint if exists sessions_booking_type_check;

alter table public.sessions
  add constraint sessions_booking_type_check
  check (booking_type in ('community', 'ticket', 'challenge'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_challenge_status_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_challenge_status_check
      check (
        challenge_status is null
        or challenge_status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_challenge_target_id_fkey'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_challenge_target_id_fkey
      foreign key (challenge_target_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists sessions_challenge_target_date_idx
on public.sessions (challenge_target_id, date, start_time)
where booking_type = 'challenge';

create or replace function public.sync_challenge_invite_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  update public.sessions
  set challenge_status = case
        when new.status = 'accepted' then 'accepted'
        when new.status = 'declined' then 'declined'
        else challenge_status
      end,
      challenge_accepted_at = case
        when new.status = 'accepted' then now()
        else challenge_accepted_at
      end,
      challenge_declined_at = case
        when new.status = 'declined' then now()
        else challenge_declined_at
      end
  where id = new.session_id
    and booking_type = 'challenge'
    and challenge_target_id = new.recipient_id;

  return new;
end;
$$;

drop trigger if exists session_invites_sync_challenge_status on public.session_invites;
create trigger session_invites_sync_challenge_status
after update of status on public.session_invites
for each row
execute function public.sync_challenge_invite_status();

revoke all on function public.sync_challenge_invite_status() from public, anon, authenticated;

create or replace function public.create_friend_challenge(
  p_target_profile_id uuid,
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_game_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_profile public.profiles%rowtype;
  v_target_profile public.profiles%rowtype;
  v_session_id uuid;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_game_id text := coalesce(nullif(p_game_id, ''), 'laser-tag');
begin
  if v_user_id is null then
    raise exception 'Login required to challenge a player.';
  end if;

  if p_target_profile_id is null then
    raise exception 'Challenge target is required.';
  end if;

  if p_target_profile_id = v_user_id then
    raise exception 'You cannot challenge yourself.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_duration_minutes < 20 or p_duration_minutes > 120 or p_duration_minutes % 20 <> 0 then
    raise exception 'Invalid challenge duration.';
  end if;

  if v_game_id not in (
    'laser-tag',
    'mini-block-towers',
    'office-war',
    'paintball',
    'snow-battle',
    'castle-unspunnen',
    'wild-west',
    'arc-of-the-covenant',
    'joller-house'
  ) then
    raise exception 'Invalid game for this challenge.';
  end if;

  select *
  into v_creator_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile required to challenge a player.';
  end if;

  select *
  into v_target_profile
  from public.profiles
  where id = p_target_profile_id;

  if not found then
    raise exception 'Challenge target profile not found.';
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

  if v_remaining_arenas < 1 then
    raise exception 'Selected time slot is no longer available.';
  end if;

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
    challenge_target_id,
    challenge_status
  ) values (
    v_user_id,
    null,
    'game',
    'Challenge - '
      || coalesce(v_creator_profile.nickname, v_creator_profile.full_name, 'Player')
      || ' vs '
      || coalesce(v_target_profile.nickname, v_target_profile.full_name, 'Player'),
    p_date,
    p_start_time,
    p_duration_minutes,
    2,
    1,
    array[v_game_id],
    jsonb_build_object(v_user_id::text, v_game_id),
    v_game_id,
    'private',
    v_invite_code,
    'Invite-only challenge match. Score it after the game.',
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
    'challenge',
    p_target_profile_id,
    'pending'
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
    profile_motto
  ) values (
    v_session_id,
    v_user_id,
    coalesce(v_creator_profile.nickname, v_creator_profile.full_name, v_creator_profile.phone, 'Player'),
    v_creator_profile.avatar_url,
    v_creator_profile.avatar_emoji,
    v_creator_profile.avatar_initials,
    v_creator_profile.avatar_color,
    v_creator_profile.avatar_text_color,
    v_creator_profile.profile_motto
  );

  insert into public.session_invites (
    session_id,
    inviter_id,
    recipient_id,
    recipient_display_name,
    recipient_avatar_url,
    recipient_avatar_emoji,
    recipient_avatar_initials,
    recipient_avatar_color,
    recipient_avatar_text_color,
    recipient_profile_motto,
    status
  ) values (
    v_session_id,
    v_user_id,
    p_target_profile_id,
    coalesce(v_target_profile.nickname, v_target_profile.full_name, v_target_profile.phone, 'Player'),
    v_target_profile.avatar_url,
    v_target_profile.avatar_emoji,
    v_target_profile.avatar_initials,
    v_target_profile.avatar_color,
    v_target_profile.avatar_text_color,
    v_target_profile.profile_motto,
    'pending'
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'booking_type', 'challenge',
    'challenge_status', 'pending'
  );
end;
$$;

revoke all on function public.create_friend_challenge(uuid, date, time, integer, text) from public, anon;
grant execute on function public.create_friend_challenge(uuid, date, time, integer, text) to authenticated;
