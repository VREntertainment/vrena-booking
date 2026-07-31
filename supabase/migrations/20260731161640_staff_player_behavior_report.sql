-- Source-backed player behavior reporting for the Staff Console.
create or replace function public.staff_player_behavior_report(
  p_start_date date,
  p_end_date date,
  p_compare_start date default null,
  p_compare_end date default null,
  p_player_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_compare_start date := case
    when p_compare_start is null or p_compare_end is null then null
    else least(p_compare_start, p_compare_end)
  end;
  v_compare_end date := case
    when p_compare_start is null or p_compare_end is null then null
    else greatest(p_compare_start, p_compare_end)
  end;
  v_player_limit integer := least(greatest(coalesce(p_player_limit, 12), 1), 50);
  v_payload jsonb;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with ranges as (
    select 'current'::text as range_key, v_start as range_start, v_end as range_end
    union all
    select 'comparison', v_compare_start, v_compare_end
    where v_compare_start is not null and v_compare_end is not null
  ),
  scoped_activity as (
    select
      ranges.range_key,
      ranges.range_start,
      ranges.range_end,
      sessions.id as session_id,
      sessions.date as session_date,
      sessions.start_time,
      coalesce(
        nullif(sessions.confirmed_game_id, ''),
        nullif(sessions.game_options[1], ''),
        'unassigned'
      ) as game_key,
      participant.profile_id,
      coalesce(participant.checked_in, false) as checked_in,
      participant.score,
      participant.accuracy_percent,
      participant.hits,
      participant.movement_meters,
      participant.escape_duration_seconds,
      participant.joined_at,
      participant.updated_at,
      (
        sessions.date::timestamp + sessions.start_time
        <= timezone('Asia/Ho_Chi_Minh', now())
      ) as is_due
    from ranges
    join public.sessions
      on sessions.date between ranges.range_start and ranges.range_end
      and sessions.deleted_at is null
      and sessions.status <> 'cancelled'
    join public.session_participants participant
      on participant.session_id = sessions.id
      and participant.deleted_at is null
    join public.profiles profile
      on profile.id = participant.profile_id
      and profile.deleted_at is null
      and not coalesce(profile.is_seed_demo, false)
  ),
  player_rollup as (
    select
      activity.range_key,
      activity.range_start,
      activity.profile_id,
      count(*)::integer as reservations,
      count(*) filter (where activity.checked_in)::integer as check_ins,
      min(activity.session_date) filter (where activity.checked_in) as first_visit,
      max(activity.session_date) filter (where activity.checked_in) as last_visit,
      avg(activity.score) filter (where activity.checked_in and activity.score is not null) as average_score,
      avg(activity.accuracy_percent) filter (where activity.checked_in and activity.accuracy_percent is not null) as average_accuracy,
      exists (
        select 1
        from public.session_participants prior_participant
        join public.sessions prior_session
          on prior_session.id = prior_participant.session_id
          and prior_session.deleted_at is null
          and prior_session.status <> 'cancelled'
        where prior_participant.profile_id = activity.profile_id
          and prior_participant.deleted_at is null
          and prior_participant.checked_in is true
          and prior_session.date < activity.range_start
      ) as had_prior_visit
    from scoped_activity activity
    group by activity.range_key, activity.range_start, activity.profile_id
  ),
  activity_summary as (
    select
      ranges.range_key,
      count(activity.profile_id)::integer as reservations,
      count(activity.profile_id) filter (where activity.is_due)::integer as due_reservations,
      count(activity.profile_id) filter (where activity.checked_in)::integer as completed_visits,
      count(distinct activity.profile_id)::integer as engaged_players,
      count(distinct activity.profile_id) filter (where activity.checked_in)::integer as checked_in_players,
      count(activity.profile_id) filter (
        where activity.checked_in
          and (
            activity.score is not null
            or activity.accuracy_percent is not null
            or activity.hits is not null
            or activity.movement_meters is not null
            or activity.escape_duration_seconds is not null
          )
      )::integer as result_rows,
      avg(activity.score) filter (where activity.checked_in and activity.score is not null) as average_score,
      avg(activity.accuracy_percent) filter (where activity.checked_in and activity.accuracy_percent is not null) as average_accuracy,
      max(coalesce(activity.updated_at, activity.joined_at)) as latest_source_at
    from ranges
    left join scoped_activity activity on activity.range_key = ranges.range_key
    group by ranges.range_key
  ),
  player_summary as (
    select
      ranges.range_key,
      count(player.profile_id) filter (where player.check_ins > 0 and player.had_prior_visit)::integer as returning_players,
      count(player.profile_id) filter (where player.check_ins > 0 and not player.had_prior_visit)::integer as first_time_players,
      count(player.profile_id) filter (where player.check_ins >= 2)::integer as repeat_players
    from ranges
    left join player_rollup player on player.range_key = ranges.range_key
    group by ranges.range_key
  ),
  social_summary as (
    select
      ranges.range_key,
      (
        select count(*)::integer
        from public.session_messages message
        join public.profiles profile on profile.id = message.author_id
        where message.deleted_at is null
          and profile.deleted_at is null
          and not coalesce(profile.is_seed_demo, false)
          and (message.created_at at time zone 'Asia/Ho_Chi_Minh')::date
            between ranges.range_start and ranges.range_end
      ) as messages,
      (
        select count(*)::integer
        from public.club_members member
        join public.profiles profile on profile.id = member.profile_id
        where member.deleted_at is null
          and member.status = 'approved'
          and profile.deleted_at is null
          and not coalesce(profile.is_seed_demo, false)
          and (member.joined_at at time zone 'Asia/Ho_Chi_Minh')::date
            between ranges.range_start and ranges.range_end
      ) as club_joins
    from ranges
  ),
  summaries as (
    select
      activity.range_key,
      jsonb_build_object(
        'engagedPlayers', activity.engaged_players,
        'checkedInPlayers', activity.checked_in_players,
        'reservations', activity.reservations,
        'dueReservations', activity.due_reservations,
        'completedVisits', activity.completed_visits,
        'returningPlayers', coalesce(players.returning_players, 0),
        'firstTimePlayers', coalesce(players.first_time_players, 0),
        'repeatPlayers', coalesce(players.repeat_players, 0),
        'attendanceRate', case
          when activity.due_reservations = 0 then 0
          else round((activity.completed_visits::numeric / activity.due_reservations) * 100, 1)
        end,
        'repeatRate', case
          when activity.checked_in_players = 0 then 0
          else round((coalesce(players.repeat_players, 0)::numeric / activity.checked_in_players) * 100, 1)
        end,
        'averageVisitsPerPlayer', case
          when activity.checked_in_players = 0 then 0
          else round(activity.completed_visits::numeric / activity.checked_in_players, 1)
        end,
        'averageScore', round(coalesce(activity.average_score, 0)::numeric, 0),
        'averageAccuracy', round(coalesce(activity.average_accuracy, 0)::numeric, 1),
        'resultRows', activity.result_rows,
        'resultCoverage', case
          when activity.completed_visits = 0 then 0
          else round((activity.result_rows::numeric / activity.completed_visits) * 100, 1)
        end,
        'messages', social.messages,
        'clubJoins', social.club_joins,
        'socialActions', social.messages + social.club_joins,
        'latestSourceAt', activity.latest_source_at
      ) as summary
    from activity_summary activity
    join player_summary players on players.range_key = activity.range_key
    join social_summary social on social.range_key = activity.range_key
  ),
  series_days as (
    select generate_series(v_start, least(v_end, v_start + 179), interval '1 day')::date as day
  ),
  activity_series as (
    select
      day.day,
      count(activity.profile_id)::integer as reservations,
      count(activity.profile_id) filter (where activity.checked_in)::integer as check_ins,
      count(distinct activity.profile_id)::integer as engaged_players
    from series_days day
    left join scoped_activity activity
      on activity.range_key = 'current'
      and activity.session_date = day.day
    group by day.day
  ),
  weekdays as (
    select generate_series(1, 7)::integer as weekday
  ),
  dayparts as (
    select * from (values
      ('morning'::text, 0, 11),
      ('afternoon'::text, 12, 16),
      ('evening'::text, 17, 23)
    ) as parts(daypart, start_hour, end_hour)
  ),
  peak_times as (
    select
      weekdays.weekday,
      dayparts.daypart,
      dayparts.start_hour,
      count(activity.profile_id) filter (where activity.checked_in)::integer as visits
    from weekdays
    cross join dayparts
    left join scoped_activity activity
      on activity.range_key = 'current'
      and extract(isodow from activity.session_date)::integer = weekdays.weekday
      and extract(hour from activity.start_time)::integer between dayparts.start_hour and dayparts.end_hour
    group by weekdays.weekday, dayparts.daypart, dayparts.start_hour
    order by weekdays.weekday, dayparts.start_hour
  ),
  game_demand as (
    select
      activity.game_key,
      coalesce(game.name, initcap(replace(activity.game_key, '-', ' ')), 'Not assigned') as game_name,
      count(*)::integer as reservations,
      count(*) filter (where activity.checked_in)::integer as visits,
      count(distinct activity.session_id)::integer as sessions
    from scoped_activity activity
    left join public.staff_games game
      on game.slug = activity.game_key
      or game.id::text = activity.game_key
    where activity.range_key = 'current'
    group by activity.game_key, game.name
    order by visits desc, reservations desc, game_name asc
    limit 6
  ),
  player_game_counts as (
    select
      activity.profile_id,
      activity.game_key,
      coalesce(game.name, initcap(replace(activity.game_key, '-', ' ')), 'Not assigned') as game_name,
      count(*) filter (where activity.checked_in)::integer as visits,
      row_number() over (
        partition by activity.profile_id
        order by count(*) filter (where activity.checked_in) desc,
          count(*) desc,
          coalesce(game.name, initcap(replace(activity.game_key, '-', ' ')), 'Not assigned') asc
      ) as game_rank
    from scoped_activity activity
    left join public.staff_games game
      on game.slug = activity.game_key
      or game.id::text = activity.game_key
    where activity.range_key = 'current'
    group by activity.profile_id, activity.game_key, game.name
  ),
  player_rows as (
    select
      player.profile_id,
      coalesce(
        nullif(profile.nickname, ''),
        nullif(profile.full_name, ''),
        nullif(profile.anonymous_callsign, ''),
        'Player'
      ) as display_name,
      player.reservations,
      player.check_ins,
      player.first_visit,
      player.last_visit,
      round(coalesce(player.average_score, 0)::numeric, 0) as average_score,
      round(coalesce(player.average_accuracy, 0)::numeric, 1) as average_accuracy,
      coalesce(favorite.game_name, 'Not assigned') as favorite_game,
      case
        when player.check_ins >= 3 then 'loyal'
        when player.check_ins >= 2 then 'repeat'
        when player.check_ins = 1 and player.had_prior_visit then 'returning'
        when player.check_ins = 1 then 'new'
        else 'booked'
      end as segment
    from player_rollup player
    join public.profiles profile on profile.id = player.profile_id
    left join player_game_counts favorite
      on favorite.profile_id = player.profile_id
      and favorite.game_rank = 1
    where player.range_key = 'current'
    order by player.check_ins desc, player.reservations desc, player.last_visit desc nulls last, display_name asc
    limit v_player_limit
  )
  select jsonb_build_object(
    'summary', coalesce((select summary from summaries where range_key = 'current'), '{}'::jsonb),
    'comparisonSummary', coalesce((select summary from summaries where range_key = 'comparison'), '{}'::jsonb),
    'activitySeries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day::text,
        'reservations', reservations,
        'checkIns', check_ins,
        'engagedPlayers', engaged_players
      ) order by day)
      from activity_series
    ), '[]'::jsonb),
    'peakTimes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', weekday,
        'daypart', daypart,
        'visits', visits
      ) order by weekday, start_hour)
      from peak_times
    ), '[]'::jsonb),
    'gameDemand', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameKey', game_key,
        'gameName', game_name,
        'reservations', reservations,
        'visits', visits,
        'sessions', sessions
      ) order by visits desc, reservations desc, game_name)
      from game_demand
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profileId', profile_id,
        'displayName', display_name,
        'reservations', reservations,
        'checkIns', check_ins,
        'firstVisit', first_visit,
        'lastVisit', last_visit,
        'averageScore', average_score,
        'averageAccuracy', average_accuracy,
        'favoriteGame', favorite_game,
        'segment', segment
      ) order by check_ins desc, reservations desc, last_visit desc nulls last, display_name)
      from player_rows
    ), '[]'::jsonb),
    'dataQuality', jsonb_build_object(
      'timezone', 'Asia/Ho_Chi_Minh',
      'seriesCappedAtDays', 180,
      'sources', jsonb_build_array('sessions', 'session_participants', 'profiles', 'session_messages', 'club_members'),
      'trackedSignals', jsonb_build_array('reservations', 'check-ins', 'scores', 'accuracy', 'session messages', 'club joins'),
      'untrackedSignals', jsonb_build_array('page views', 'click paths', 'searches', 'session duration', 'device and acquisition source')
    )
  )
  into v_payload;

  return coalesce(v_payload, '{}'::jsonb);
end;
$function$;

revoke all on function public.staff_player_behavior_report(date, date, date, date, integer) from public;
revoke all on function public.staff_player_behavior_report(date, date, date, date, integer) from anon;
grant execute on function public.staff_player_behavior_report(date, date, date, date, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
