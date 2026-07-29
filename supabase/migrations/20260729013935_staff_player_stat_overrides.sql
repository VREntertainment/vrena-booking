begin;

create table if not exists public.player_stat_overrides (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null,
  sessions_joined integer check (sessions_joined is null or sessions_joined >= 0),
  games_joined integer check (games_joined is null or games_joined >= 0),
  wins integer check (wins is null or wins >= 0),
  best_performer_count integer check (best_performer_count is null or best_performer_count >= 0),
  total_score integer,
  best_score integer,
  average_accuracy double precision check (
    average_accuracy is null
    or (average_accuracy >= 0 and average_accuracy <= 100)
  ),
  total_projectiles integer check (total_projectiles is null or total_projectiles >= 0),
  total_movement_meters double precision check (
    total_movement_meters is null
    or total_movement_meters >= 0
  ),
  best_escape_duration_seconds integer check (
    best_escape_duration_seconds is null
    or best_escape_duration_seconds > 0
  ),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, scope),
  constraint player_stat_overrides_scope_length
    check (char_length(scope) between 1 and 120)
);

create index if not exists player_stat_overrides_updated_by_idx
  on public.player_stat_overrides (updated_by, updated_at desc);

insert into public.player_stat_overrides (
  profile_id,
  scope,
  average_accuracy,
  total_projectiles,
  best_escape_duration_seconds
)
select
  profiles.id,
  'overall',
  profiles.average_accuracy_override,
  profiles.total_projectiles_override,
  profiles.best_escape_duration_seconds_override
from public.profiles
where profiles.average_accuracy_override is not null
   or profiles.total_projectiles_override is not null
   or profiles.best_escape_duration_seconds_override is not null
on conflict (profile_id, scope)
do update set
  average_accuracy = coalesce(
    player_stat_overrides.average_accuracy,
    excluded.average_accuracy
  ),
  total_projectiles = coalesce(
    player_stat_overrides.total_projectiles,
    excluded.total_projectiles
  ),
  best_escape_duration_seconds = coalesce(
    player_stat_overrides.best_escape_duration_seconds,
    excluded.best_escape_duration_seconds
  ),
  updated_at = now();

alter table public.player_stat_overrides enable row level security;

revoke all on table public.player_stat_overrides from public, anon, authenticated;
grant select on table public.player_stat_overrides to authenticated;
grant all on table public.player_stat_overrides to service_role;

drop policy if exists "staff player stat overrides select" on public.player_stat_overrides;
create policy "staff player stat overrides select"
on public.player_stat_overrides
for select
to authenticated
using (private.is_staff_console_user(50));

create or replace function private.player_stat_overrides_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists player_stat_overrides_touch_updated_at on public.player_stat_overrides;
create trigger player_stat_overrides_touch_updated_at
before update on public.player_stat_overrides
for each row
execute function private.player_stat_overrides_touch_updated_at();

revoke all on function private.player_stat_overrides_touch_updated_at()
from public, anon, authenticated;

create or replace function public.staff_get_player_stat_overrides(
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_loyalty_points integer;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  select profiles.loyalty_points_total
  into v_loyalty_points
  from public.profiles
  where profiles.id = p_profile_id
    and profiles.deleted_at is null;

  if not found then
    raise exception 'Profile not found.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'scope', overrides.scope,
        'sessionsJoined', overrides.sessions_joined,
        'gamesJoined', overrides.games_joined,
        'wins', overrides.wins,
        'bestPerformerCount', overrides.best_performer_count,
        'totalScore', overrides.total_score,
        'bestScore', overrides.best_score,
        'averageAccuracy', overrides.average_accuracy,
        'totalProjectiles', overrides.total_projectiles,
        'totalMovementMeters', overrides.total_movement_meters,
        'bestEscapeDurationSeconds', overrides.best_escape_duration_seconds
      ))
      order by overrides.scope
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.player_stat_overrides overrides
  where overrides.profile_id = p_profile_id;

  return jsonb_build_object(
    'profileId', p_profile_id,
    'loyaltyPoints', coalesce(v_loyalty_points, 0),
    'overrides', v_rows
  );
end;
$$;

revoke all on function public.staff_get_player_stat_overrides(uuid)
from public, anon;
grant execute on function public.staff_get_player_stat_overrides(uuid)
to authenticated, service_role;

create or replace function public.staff_set_player_stat_overrides(
  p_profile_id uuid,
  p_loyalty_points integer,
  p_overall jsonb,
  p_games jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_entries jsonb;
  v_entry jsonb;
  v_scope text;
  v_sessions_joined integer;
  v_games_joined integer;
  v_wins integer;
  v_best_performer_count integer;
  v_total_score integer;
  v_best_score integer;
  v_average_accuracy double precision;
  v_total_projectiles integer;
  v_total_movement_meters double precision;
  v_best_escape_duration_seconds integer;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_loyalty_points is null or p_loyalty_points < 0 then
    raise exception 'Loyalty points must be zero or higher.';
  end if;

  if p_overall is null or jsonb_typeof(p_overall) <> 'object' then
    raise exception 'Overall stats must be an object.';
  end if;

  if p_games is null or jsonb_typeof(p_games) <> 'array' then
    raise exception 'Game stats must be an array.';
  end if;

  if jsonb_array_length(p_games) > 100 then
    raise exception 'Too many game stat rows.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Profile not found.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(existing) order by existing.scope), '[]'::jsonb)
  into v_before
  from public.player_stat_overrides existing
  where existing.profile_id = p_profile_id;

  v_entries := jsonb_build_array(p_overall || jsonb_build_object('scope', 'overall')) || p_games;

  for v_entry in
    select value
    from jsonb_array_elements(v_entries)
  loop
    v_scope := lower(nullif(btrim(v_entry ->> 'scope'), ''));

    if v_scope is null or char_length(v_scope) > 120 or v_scope !~ '^[a-z0-9][a-z0-9-]*$' then
      raise exception 'Choose a valid stat scope.';
    end if;

    if v_scope <> 'overall' and not exists (
      select 1
      from public.staff_games
      where slug = v_scope
    ) then
      raise exception 'Game not found: %', v_scope;
    end if;

    v_sessions_joined := nullif(v_entry ->> 'sessionsJoined', '')::integer;
    v_games_joined := nullif(v_entry ->> 'gamesJoined', '')::integer;
    v_wins := nullif(v_entry ->> 'wins', '')::integer;
    v_best_performer_count := nullif(v_entry ->> 'bestPerformerCount', '')::integer;
    v_total_score := nullif(v_entry ->> 'totalScore', '')::integer;
    v_best_score := nullif(v_entry ->> 'bestScore', '')::integer;
    v_average_accuracy := nullif(v_entry ->> 'averageAccuracy', '')::double precision;
    v_total_projectiles := nullif(v_entry ->> 'totalProjectiles', '')::integer;
    v_total_movement_meters := nullif(v_entry ->> 'totalMovementMeters', '')::double precision;
    v_best_escape_duration_seconds := nullif(v_entry ->> 'bestEscapeDurationSeconds', '')::integer;

    if coalesce(v_sessions_joined, 0) < 0
      or coalesce(v_games_joined, 0) < 0
      or coalesce(v_wins, 0) < 0
      or coalesce(v_best_performer_count, 0) < 0
      or coalesce(v_total_projectiles, 0) < 0
      or coalesce(v_total_movement_meters, 0) < 0
    then
      raise exception 'Counts and movement must be zero or higher.';
    end if;

    if v_average_accuracy is not null
      and (v_average_accuracy < 0 or v_average_accuracy > 100)
    then
      raise exception 'Accuracy must be between 0 and 100.';
    end if;

    if v_best_escape_duration_seconds is not null
      and v_best_escape_duration_seconds <= 0
    then
      raise exception 'Best escape time must be greater than zero.';
    end if;

    if v_games_joined is not null
      and v_wins is not null
      and v_wins > v_games_joined
    then
      raise exception 'Wins cannot be higher than games played.';
    end if;

    if v_scope = 'overall' then
      v_best_score := null;
    end if;

    if v_sessions_joined is null
      and v_games_joined is null
      and v_wins is null
      and v_best_performer_count is null
      and v_total_score is null
      and v_best_score is null
      and v_average_accuracy is null
      and v_total_projectiles is null
      and v_total_movement_meters is null
      and v_best_escape_duration_seconds is null
    then
      delete from public.player_stat_overrides
      where profile_id = p_profile_id
        and scope = v_scope;
    else
      insert into public.player_stat_overrides (
        profile_id,
        scope,
        sessions_joined,
        games_joined,
        wins,
        best_performer_count,
        total_score,
        best_score,
        average_accuracy,
        total_projectiles,
        total_movement_meters,
        best_escape_duration_seconds,
        updated_by
      )
      values (
        p_profile_id,
        v_scope,
        v_sessions_joined,
        v_games_joined,
        v_wins,
        v_best_performer_count,
        v_total_score,
        v_best_score,
        v_average_accuracy,
        v_total_projectiles,
        v_total_movement_meters,
        v_best_escape_duration_seconds,
        v_actor
      )
      on conflict (profile_id, scope)
      do update set
        sessions_joined = excluded.sessions_joined,
        games_joined = excluded.games_joined,
        wins = excluded.wins,
        best_performer_count = excluded.best_performer_count,
        total_score = excluded.total_score,
        best_score = excluded.best_score,
        average_accuracy = excluded.average_accuracy,
        total_projectiles = excluded.total_projectiles,
        total_movement_meters = excluded.total_movement_meters,
        best_escape_duration_seconds = excluded.best_escape_duration_seconds,
        updated_by = excluded.updated_by,
        updated_at = now();
    end if;
  end loop;

  update public.profiles
  set average_accuracy_override = nullif(p_overall ->> 'averageAccuracy', '')::double precision,
      total_projectiles_override = nullif(p_overall ->> 'totalProjectiles', '')::integer,
      best_escape_duration_seconds_override = nullif(
        p_overall ->> 'bestEscapeDurationSeconds',
        ''
      )::integer,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null;

  perform public.set_profile_loyalty_points(
    p_profile_id,
    p_loyalty_points,
    'Player stats editor'
  );

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value
    )
    values (
      v_actor,
      'player_stat_overrides_updated',
      'profiles',
      p_profile_id,
      jsonb_build_object('overrides', v_before),
      jsonb_build_object(
        'loyaltyPoints', p_loyalty_points,
        'overrides', (
          select coalesce(jsonb_agg(to_jsonb(saved) order by saved.scope), '[]'::jsonb)
          from public.player_stat_overrides saved
          where saved.profile_id = p_profile_id
        )
      )
    );
  end if;

  return public.staff_get_player_stat_overrides(p_profile_id);
end;
$$;

revoke all on function public.staff_set_player_stat_overrides(uuid, integer, jsonb, jsonb)
from public, anon;
grant execute on function public.staff_set_player_stat_overrides(uuid, integer, jsonb, jsonb)
to authenticated, service_role;

create or replace function public.get_leaderboard_players_page_v3(
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null,
  p_rank_by text default 'totalScore',
  p_profile_id uuid default null,
  p_club_id uuid default null,
  p_club_pin text default null,
  p_game_id text default null
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
  total_movement_meters double precision,
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
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by,
      nullif(lower(trim(coalesce(p_game_id, ''))), '') as game_id
  ),
  source_rows as (
    select *
    from public.get_leaderboard_players_page_v2(
      5000,
      0,
      p_search,
      'totalScore',
      null,
      p_club_id,
      p_club_pin,
      p_game_id
    )
  ),
  enhanced_rows as (
    select
      source_rows.profile_id,
      source_rows.display_name,
      source_rows.avatar_url,
      source_rows.avatar_emoji,
      source_rows.avatar_initials,
      source_rows.avatar_color,
      source_rows.avatar_text_color,
      source_rows.profile_motto,
      coalesce(active_override.sessions_joined, source_rows.sessions_joined)::integer as sessions_joined,
      coalesce(active_override.games_joined, source_rows.games_joined)::integer as games_joined,
      coalesce(active_override.wins, source_rows.wins)::integer as wins,
      coalesce(active_override.best_performer_count, source_rows.best_performer_count)::integer as best_performer_count,
      source_rows.base_total_score,
      coalesce(active_override.total_score, source_rows.total_score)::integer as total_score,
      (
        coalesce(active_override.total_score, source_rows.total_score)
        - source_rows.base_total_score
      )::integer as score_adjustment,
      case
        when active_override.average_accuracy is not null
          then active_override.average_accuracy * greatest(source_rows.accuracy_count, 1)
        else source_rows.total_accuracy
      end::double precision as total_accuracy,
      source_rows.accuracy_count,
      coalesce(active_override.total_projectiles, source_rows.total_projectiles)::integer as total_projectiles,
      coalesce(active_override.total_movement_meters, source_rows.total_movement_meters)::double precision as total_movement_meters,
      coalesce(active_override.average_accuracy, source_rows.average_accuracy)::double precision as average_accuracy,
      case
        when coalesce(active_override.sessions_joined, source_rows.sessions_joined) > 0
          then (
            coalesce(active_override.games_joined, source_rows.games_joined)::double precision
            / coalesce(active_override.sessions_joined, source_rows.sessions_joined)::double precision
          ) * 100
        else 0
      end::double precision as reliability_score,
      case
        when normalized_args.game_id is null
          and active_override.best_escape_duration_seconds is not null
        then coalesce((
          select jsonb_agg(game_score - 'escapeDurationSeconds')
          from jsonb_array_elements(
            coalesce(merged_games.best_by_game, source_rows.best_by_game, '[]'::jsonb)
          ) game_score
        ), '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'game', '__overall__',
          'escapeDurationSeconds', active_override.best_escape_duration_seconds
        ))
        else coalesce(merged_games.best_by_game, source_rows.best_by_game, '[]'::jsonb)
      end as best_by_game,
      active_override.best_escape_duration_seconds
    from source_rows
    cross join normalized_args
    left join public.player_stat_overrides active_override
      on active_override.profile_id = source_rows.profile_id
     and active_override.scope = coalesce(normalized_args.game_id, 'overall')
    left join lateral (
      with base_scores as (
        select
          nullif(score_row ->> 'game', '') as game_slug,
          nullif(score_row ->> 'score', '')::integer as score,
          nullif(score_row ->> 'escapeDurationSeconds', '')::integer as escape_duration_seconds
        from jsonb_array_elements(coalesce(source_rows.best_by_game, '[]'::jsonb)) score_row
      ),
      game_overrides as (
        select scoped_overrides.*
        from public.player_stat_overrides scoped_overrides
        where scoped_overrides.profile_id = source_rows.profile_id
          and scoped_overrides.scope <> 'overall'
      )
      select coalesce(
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'game', merged.game_slug,
            'score', merged.score,
            'escapeDurationSeconds', merged.escape_duration_seconds
          ))
          order by
            merged.escape_duration_seconds asc nulls last,
            merged.score desc,
            merged.game_slug
        ) filter (where merged.score is not null),
        '[]'::jsonb
      ) as best_by_game
      from (
        select
          coalesce(base_scores.game_slug, game_overrides.scope) as game_slug,
          coalesce(
            game_overrides.best_score,
            base_scores.score,
            game_overrides.total_score,
            case
              when coalesce(
                game_overrides.best_escape_duration_seconds,
                base_scores.escape_duration_seconds
              ) is not null
              then 0
            end
          )::integer as score,
          coalesce(
            game_overrides.best_escape_duration_seconds,
            base_scores.escape_duration_seconds
          )::integer as escape_duration_seconds
        from base_scores
        full outer join game_overrides
          on game_overrides.scope = base_scores.game_slug
      ) merged
    ) merged_games on true
  ),
  metric_rows as (
    select
      enhanced_rows.*,
      case normalized_args.rank_by
        when 'wins' then enhanced_rows.wins::double precision
        when 'winRate' then case
          when enhanced_rows.games_joined > 0
            then (enhanced_rows.wins::double precision / enhanced_rows.games_joined::double precision) * 100
          else 0
        end
        when 'accuracy' then coalesce(enhanced_rows.average_accuracy, 0)
        when 'reliability' then enhanced_rows.reliability_score
        when 'projectiles' then enhanced_rows.total_projectiles::double precision
        when 'hits' then enhanced_rows.total_projectiles::double precision
        when 'movement' then enhanced_rows.total_movement_meters
        when 'gamesPlayed' then enhanced_rows.games_joined::double precision
        when 'escapeTime' then coalesce(
          enhanced_rows.best_escape_duration_seconds,
          (
            select min(nullif(game_score ->> 'escapeDurationSeconds', '')::double precision)
            from jsonb_array_elements(coalesce(enhanced_rows.best_by_game, '[]'::jsonb)) game_score
            where nullif(game_score ->> 'escapeDurationSeconds', '') is not null
              and (
                normalized_args.game_id is null
                or game_score ->> 'game' = normalized_args.game_id
              )
          ),
          0
        )
        else enhanced_rows.total_score::double precision
      end as metric_value
    from enhanced_rows
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
      (dense_rank() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last
      ))::integer as leaderboard_distinct_rank,
      (row_number() over (
        order by
          case when metric_rows.metric_value > 0 then 0 else 1 end asc,
          case when normalized_args.rank_by = 'escapeTime' then metric_rows.metric_value end asc nulls last,
          case when normalized_args.rank_by <> 'escapeTime' then metric_rows.metric_value end desc nulls last,
          metric_rows.total_score desc,
          metric_rows.display_name asc,
          metric_rows.profile_id asc
      ))::integer as page_position,
      (count(*) over ())::integer as leaderboard_total_count
    from metric_rows
    cross join normalized_args
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
    ranked_rows.total_movement_meters,
    ranked_rows.average_accuracy,
    ranked_rows.reliability_score,
    ranked_rows.best_by_game,
    ranked_rows.leaderboard_rank,
    ranked_rows.leaderboard_distinct_rank,
    case
      when normalized_args.rank_by = 'escapeTime' then (
        select max(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > 0
          and higher_rows.metric_value < ranked_rows.metric_value
      )
      else (
        select min(higher_rows.metric_value)
        from metric_rows higher_rows
        where higher_rows.metric_value > ranked_rows.metric_value
      )
    end::double precision,
    ranked_rows.metric_value::double precision,
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
  order by ranked_rows.page_position;
$$;

revoke all on function public.get_leaderboard_players_page_v3(
  integer, integer, text, text, uuid, uuid, text, text
) from public;
grant execute on function public.get_leaderboard_players_page_v3(
  integer, integer, text, text, uuid, uuid, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
