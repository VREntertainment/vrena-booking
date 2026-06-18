alter table public.session_participants
add column if not exists escape_duration_seconds integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'session_participants_escape_duration_seconds_check'
      and conrelid = 'public.session_participants'::regclass
  ) then
    alter table public.session_participants
    add constraint session_participants_escape_duration_seconds_check
    check (escape_duration_seconds is null or escape_duration_seconds > 0);
  end if;
end $$;

create index if not exists session_participants_escape_duration_idx
on public.session_participants (escape_duration_seconds)
where escape_duration_seconds is not null;

grant update (escape_duration_seconds) on public.session_participants to authenticated;
grant update on public.session_participants to service_role;

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
      session_participants.escape_duration_seconds,
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
