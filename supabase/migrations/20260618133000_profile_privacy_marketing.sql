alter table public.profiles
  add column if not exists anonymous_mode boolean not null default false,
  add column if not exists anonymous_callsign text,
  add column if not exists marketing_consent boolean not null default true,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_opted_out_at timestamptz;

create table if not exists public.marketing_list (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  full_name text,
  nickname text,
  phone text,
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_list enable row level security;

grant select, insert, update, delete on public.marketing_list to authenticated;
grant select, insert, update, delete on public.marketing_list to service_role;

drop policy if exists "users manage own marketing consent row" on public.marketing_list;
create policy "users manage own marketing consent row"
on public.marketing_list
for all
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

drop policy if exists "admins read marketing list" on public.marketing_list;
create policy "admins read marketing list"
on public.marketing_list
for select
using (public.is_vrena_admin());

create or replace function public.profile_anonymous_callsign(p_profile_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['ECHO', 'NOVA', 'ORION', 'CIPHER', 'PHANTOM', 'VORTEX', 'NEON', 'PULSE'])[
      (abs(hashtext(coalesce(p_profile_id::text, 'private-player'))::bigint) % 8) + 1
    ]
    || '-'
    || lpad(((abs(hashtext(coalesce(p_profile_id::text, 'private-player'))::bigint) % 900) + 100)::text, 3, '0');
$$;

create or replace function public.profile_public_display_name(
  p_profile_id uuid,
  p_nickname text,
  p_full_name text,
  p_phone text,
  p_anonymous_mode boolean,
  p_anonymous_callsign text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_anonymous_mode, false) then coalesce(
      nullif(trim(p_nickname), ''),
      nullif(trim(p_anonymous_callsign), ''),
      public.profile_anonymous_callsign(p_profile_id)
    )
    else coalesce(
      nullif(trim(p_nickname), ''),
      nullif(trim(p_full_name), ''),
      nullif(trim(p_phone), ''),
      'Player'
    )
  end;
$$;

create or replace function public.sync_profile_public_snapshot(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_display_name text;
  v_avatar_url text;
  v_avatar_emoji text;
  v_avatar_initials text;
  v_avatar_color text;
  v_avatar_text_color text;
begin
  if p_profile_id is distinct from auth.uid() and not public.is_vrena_admin() then
    raise exception 'Not authorized';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  v_display_name := public.profile_public_display_name(
    v_profile.id,
    v_profile.nickname,
    v_profile.full_name,
    v_profile.phone,
    v_profile.anonymous_mode,
    v_profile.anonymous_callsign
  );

  if coalesce(v_profile.anonymous_mode, false) then
    v_avatar_url := null;
    v_avatar_emoji := '🎭';
    v_avatar_initials := null;
    v_avatar_color := '#11181b';
    v_avatar_text_color := '#ffffff';
  else
    v_avatar_url := v_profile.avatar_url;
    v_avatar_emoji := v_profile.avatar_emoji;
    v_avatar_initials := v_profile.avatar_initials;
    v_avatar_color := v_profile.avatar_color;
    v_avatar_text_color := v_profile.avatar_text_color;
  end if;

  update public.session_participants
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where profile_id = p_profile_id;

  update public.session_waitlist
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where profile_id = p_profile_id;

  update public.club_members
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where profile_id = p_profile_id;

  update public.tournament_editors
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where profile_id = p_profile_id;

  update public.user_follows
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      avatar_emoji = v_avatar_emoji,
      avatar_initials = v_avatar_initials,
      avatar_color = v_avatar_color,
      avatar_text_color = v_avatar_text_color,
      profile_motto = v_profile.profile_motto
  where following_id = p_profile_id;

  update public.session_invites
  set recipient_display_name = v_display_name,
      recipient_avatar_url = v_avatar_url,
      recipient_avatar_emoji = v_avatar_emoji,
      recipient_avatar_initials = v_avatar_initials,
      recipient_avatar_color = v_avatar_color,
      recipient_avatar_text_color = v_avatar_text_color,
      recipient_profile_motto = v_profile.profile_motto
  where recipient_id = p_profile_id;

  update public.sessions as challenge_sessions
  set name = 'Challenge - '
      || public.profile_public_display_name(
        owner_profile.id,
        owner_profile.nickname,
        owner_profile.full_name,
        owner_profile.phone,
        owner_profile.anonymous_mode,
        owner_profile.anonymous_callsign
      )
      || ' vs '
      || public.profile_public_display_name(
        target_profile.id,
        target_profile.nickname,
        target_profile.full_name,
        target_profile.phone,
        target_profile.anonymous_mode,
        target_profile.anonymous_callsign
      )
  from public.profiles as owner_profile,
       public.profiles as target_profile
  where challenge_sessions.booking_type = 'challenge'
    and owner_profile.id = challenge_sessions.owner_id
    and target_profile.id = challenge_sessions.challenge_target_id
    and (
      challenge_sessions.owner_id = p_profile_id
      or challenge_sessions.challenge_target_id = p_profile_id
    );

  update public.session_messages
  set author_display_name = v_display_name,
      author_avatar_url = v_avatar_url,
      author_avatar_emoji = v_avatar_emoji,
      author_avatar_initials = v_avatar_initials,
      author_avatar_color = v_avatar_color,
      author_avatar_text_color = v_avatar_text_color,
      author_profile_motto = v_profile.profile_motto
  where author_id = p_profile_id;
end;
$$;

grant execute on function public.sync_profile_public_snapshot(uuid) to authenticated, service_role;

insert into public.marketing_list (profile_id, email, full_name, nickname, phone, consented_at, updated_at)
select
  profiles.id,
  profiles.email,
  profiles.full_name,
  profiles.nickname,
  profiles.phone,
  coalesce(profiles.marketing_consent_at, now()),
  now()
from public.profiles
where coalesce(profiles.marketing_consent, true)
on conflict (profile_id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone = excluded.phone,
    updated_at = excluded.updated_at;

delete from public.marketing_list
using public.profiles
where marketing_list.profile_id = profiles.id
  and profiles.marketing_consent = false;

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
      session_participants.placement,
      active_sessions.game_options
    from public.session_participants
    join active_sessions
      on active_sessions.id = session_participants.session_id
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
      coalesce(sum(participant_rows.projectiles_fired) filter (where participant_rows.projectiles_fired is not null), 0)::integer as total_projectiles
    from public.profiles
    left join participant_rows
      on participant_rows.profile_id = profiles.id
    left join unique_best_performers
      on unique_best_performers.id = participant_rows.id
    group by profiles.id
  ),
  participant_game_scores as (
    select
      participant_rows.profile_id,
      game_id,
      participant_rows.score
    from participant_rows
    cross join lateral unnest(coalesce(participant_rows.game_options, array[]::text[])) as game_id
    where participant_rows.score is not null
  ),
  best_game_scores as (
    select
      participant_game_scores.profile_id,
      participant_game_scores.game_id,
      case
        when participant_game_scores.game_id in ('arc-of-the-covenant', 'joller-house') then min(participant_game_scores.score)
        else max(participant_game_scores.score)
      end::integer as score
    from participant_game_scores
    group by participant_game_scores.profile_id, participant_game_scores.game_id
  ),
  best_game_json as (
    select
      best_game_scores.profile_id,
      jsonb_agg(
        jsonb_build_object(
          'game',
          best_game_scores.game_id,
          'score',
          best_game_scores.score
        )
        order by best_game_scores.score desc, best_game_scores.game_id
      ) as best_by_game
    from best_game_scores
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
  ),
  current_profile as (
    select
      profiles.id,
      profiles.email,
      profiles.role
    from public.profiles
    where profiles.id = auth.uid()
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
          where lower(coalesce(current_profile.role, '')) = 'admin'
            or lower(coalesce(current_profile.email, '')) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com')
        )
        or exists (
          select 1
          from public.club_members
          where club_members.club_id = selected_club.id
            and club_members.profile_id = auth.uid()
            and club_members.status = 'approved'
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
        else filtered_rows.total_score::double precision
      end as metric_value
    from filtered_rows
    cross join normalized_args
  ),
  distinct_metric_values as (
    select
      distinct_values.metric_value,
      (dense_rank() over (order by distinct_values.metric_value desc))::integer as distinct_rank,
      lag(distinct_values.metric_value) over (order by distinct_values.metric_value desc) as higher_metric_value
    from (
      select distinct metric_rows.metric_value
      from metric_rows
      where metric_rows.metric_value > 0
    ) distinct_values
  ),
  ranked_rows as (
    select
      metric_rows.*,
      (rank() over (order by metric_rows.metric_value desc))::integer as leaderboard_rank,
      (row_number() over (
        order by metric_rows.metric_value desc,
          metric_rows.total_score desc,
          metric_rows.best_performer_count desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count,
      distinct_metric_values.distinct_rank as leaderboard_distinct_rank,
      distinct_metric_values.higher_metric_value as leaderboard_higher_metric_value
    from metric_rows
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

create or replace function public.get_leaderboard_players()
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
  best_by_game jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    page_rows.profile_id,
    page_rows.display_name,
    page_rows.avatar_url,
    page_rows.avatar_emoji,
    page_rows.avatar_initials,
    page_rows.avatar_color,
    page_rows.avatar_text_color,
    page_rows.profile_motto,
    page_rows.sessions_joined,
    page_rows.games_joined,
    page_rows.wins,
    page_rows.best_performer_count,
    page_rows.base_total_score,
    page_rows.total_score,
    page_rows.score_adjustment,
    page_rows.total_accuracy,
    page_rows.accuracy_count,
    page_rows.total_projectiles,
    page_rows.average_accuracy,
    page_rows.reliability_score,
    page_rows.best_by_game
  from public.get_leaderboard_players_page(5000, 0, null, 'totalScore', null, null, null) as page_rows;
$$;

grant execute on function public.get_leaderboard_players() to anon, authenticated, service_role;

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
  v_creator_display_name text;
  v_target_display_name text;
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

  v_creator_display_name := public.profile_public_display_name(
    v_creator_profile.id,
    v_creator_profile.nickname,
    v_creator_profile.full_name,
    v_creator_profile.phone,
    v_creator_profile.anonymous_mode,
    v_creator_profile.anonymous_callsign
  );

  v_target_display_name := public.profile_public_display_name(
    v_target_profile.id,
    v_target_profile.nickname,
    v_target_profile.full_name,
    v_target_profile.phone,
    v_target_profile.anonymous_mode,
    v_target_profile.anonymous_callsign
  );

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
    'Challenge - ' || v_creator_display_name || ' vs ' || v_target_display_name,
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
    v_creator_display_name,
    case when coalesce(v_creator_profile.anonymous_mode, false) then null else v_creator_profile.avatar_url end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then '🎭' else v_creator_profile.avatar_emoji end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then null else v_creator_profile.avatar_initials end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then '#11181b' else v_creator_profile.avatar_color end,
    case when coalesce(v_creator_profile.anonymous_mode, false) then '#ffffff' else v_creator_profile.avatar_text_color end,
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
    v_target_display_name,
    case when coalesce(v_target_profile.anonymous_mode, false) then null else v_target_profile.avatar_url end,
    case when coalesce(v_target_profile.anonymous_mode, false) then '🎭' else v_target_profile.avatar_emoji end,
    case when coalesce(v_target_profile.anonymous_mode, false) then null else v_target_profile.avatar_initials end,
    case when coalesce(v_target_profile.anonymous_mode, false) then '#11181b' else v_target_profile.avatar_color end,
    case when coalesce(v_target_profile.anonymous_mode, false) then '#ffffff' else v_target_profile.avatar_text_color end,
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
