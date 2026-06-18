create index if not exists sessions_active_date_start_idx
on public.sessions (date, start_time)
where status <> 'cancelled';

create index if not exists session_participants_profile_session_idx
on public.session_participants (profile_id, session_id);

create index if not exists session_participants_session_profile_idx
on public.session_participants (session_id, profile_id);

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
  with active_sessions as (
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
  )
  select
    profiles.id as profile_id,
    coalesce(nullif(profiles.nickname, ''), nullif(profiles.full_name, ''), nullif(profiles.phone, ''), 'Player') as display_name,
    profiles.avatar_url,
    profiles.avatar_emoji,
    profiles.avatar_initials,
    profiles.avatar_color,
    profiles.avatar_text_color,
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
  order by profile_stats.base_total_score + coalesce(profiles.score_adjustment, 0)::integer desc,
    profile_stats.best_performer_count desc,
    display_name asc;
$$;

grant execute on function public.get_leaderboard_players() to anon, authenticated, service_role;
