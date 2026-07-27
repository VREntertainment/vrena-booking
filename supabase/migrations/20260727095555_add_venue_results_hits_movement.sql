begin;

alter table public.session_participants
  add column if not exists hits integer,
  add column if not exists movement_meters numeric(10, 2);

alter table public.profiles
  add column if not exists total_hits_override integer;

update public.profiles
set total_hits_override = total_projectiles_override
where total_hits_override is null
  and total_projectiles_override is not null;

alter table public.profiles
  drop constraint if exists profiles_total_hits_override_check,
  add constraint profiles_total_hits_override_check
    check (total_hits_override is null or total_hits_override >= 0);

alter table public.clubs
  drop constraint if exists clubs_ranking_criterion_check,
  add constraint clubs_ranking_criterion_check
    check (
      ranking_criterion in (
        'totalScore',
        'wins',
        'winRate',
        'accuracy',
        'reliability',
        'projectiles',
        'hits',
        'movement',
        'gamesPlayed'
      )
    );

update public.session_participants
set hits = projectiles_fired
where hits is null
  and projectiles_fired is not null;

alter table public.session_participants
  drop constraint if exists session_participants_hits_check,
  add constraint session_participants_hits_check
    check (hits is null or hits >= 0),
  drop constraint if exists session_participants_movement_meters_check,
  add constraint session_participants_movement_meters_check
    check (movement_meters is null or movement_meters >= 0);

comment on column public.session_participants.projectiles_fired is
  'Deprecated compatibility field. Use hits for result-screen imports and staff result entry.';
comment on column public.session_participants.hits is
  'Number of successful hits shown in the VR game results screen.';
comment on column public.session_participants.movement_meters is
  'Movement distance in meters shown in the VR game results screen.';

create or replace function public.sync_session_participant_legacy_hits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.hits := coalesce(new.hits, new.projectiles_fired);
    new.projectiles_fired := coalesce(new.hits, new.projectiles_fired);
    return new;
  end if;

  if new.hits is distinct from old.hits then
    new.projectiles_fired := new.hits;
  elsif new.projectiles_fired is distinct from old.projectiles_fired then
    new.hits := new.projectiles_fired;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_session_participant_legacy_hits() from public, anon, authenticated;
grant execute on function public.sync_session_participant_legacy_hits() to service_role;

drop trigger if exists session_participants_a_sync_legacy_hits on public.session_participants;
create trigger session_participants_a_sync_legacy_hits
before insert or update on public.session_participants
for each row execute function public.sync_session_participant_legacy_hits();

create table if not exists public.venue_game_results (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  matched_session_id uuid references public.sessions(id) on delete set null,
  matched_participant_id uuid references public.session_participants(id) on delete set null,
  player_name text not null,
  game_name text,
  game_slug text,
  score integer not null,
  hits integer not null,
  accuracy_percent double precision,
  movement_meters numeric(10, 2),
  external_session_label text,
  captured_at timestamptz not null,
  source_capture_id text not null,
  source_device text not null default 'VRena Results Capture',
  match_status text not null default 'player_only',
  created_at timestamptz not null default now(),
  constraint venue_game_results_player_name_check
    check (char_length(player_name) between 1 and 80),
  constraint venue_game_results_game_name_check
    check (game_name is null or char_length(game_name) <= 120),
  constraint venue_game_results_game_slug_check
    check (game_slug is null or game_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint venue_game_results_score_check
    check (score >= 0),
  constraint venue_game_results_hits_check
    check (hits >= 0),
  constraint venue_game_results_accuracy_check
    check (accuracy_percent is null or (accuracy_percent >= 0 and accuracy_percent <= 100)),
  constraint venue_game_results_movement_check
    check (movement_meters is null or movement_meters >= 0),
  constraint venue_game_results_source_capture_check
    check (char_length(source_capture_id) between 16 and 128),
  constraint venue_game_results_match_status_check
    check (match_status in ('session_matched', 'player_only', 'session_ambiguous')),
  constraint venue_game_results_session_pair_check
    check (
      (match_status = 'session_matched' and matched_session_id is not null and matched_participant_id is not null)
      or
      (match_status <> 'session_matched' and matched_session_id is null and matched_participant_id is null)
    ),
  unique (source_capture_id, player_name)
);

create index if not exists venue_game_results_profile_captured_idx
on public.venue_game_results (profile_id, captured_at desc);

create index if not exists venue_game_results_unmatched_profile_idx
on public.venue_game_results (profile_id, captured_at desc)
where matched_participant_id is null;

create index if not exists venue_game_results_session_idx
on public.venue_game_results (matched_session_id, matched_participant_id)
where matched_session_id is not null;

alter table public.venue_game_results enable row level security;

revoke all on table public.venue_game_results from public, anon, authenticated;
grant select on table public.venue_game_results to authenticated;
grant select, insert, update, delete on table public.venue_game_results to service_role;

drop policy if exists "venue results visible to player or session viewers"
on public.venue_game_results;
create policy "venue results visible to player or session viewers"
on public.venue_game_results
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (
    matched_session_id is not null
    and public.can_view_session_row(matched_session_id)
  )
);

comment on table public.venue_game_results is
  'Auditable VR result-screen imports. Results without a unique session match remain profile-only.';

create or replace function public.service_ingest_venue_game_result(
  p_profile_id uuid,
  p_player_name text,
  p_game_name text,
  p_game_slug text,
  p_score integer,
  p_hits integer,
  p_accuracy_percent double precision,
  p_movement_meters numeric,
  p_external_session_label text,
  p_captured_at timestamptz,
  p_source_capture_id text,
  p_source_device text,
  p_match_status text,
  p_matched_session_id uuid default null,
  p_matched_participant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  insert into public.venue_game_results (
    profile_id,
    matched_session_id,
    matched_participant_id,
    player_name,
    game_name,
    game_slug,
    score,
    hits,
    accuracy_percent,
    movement_meters,
    external_session_label,
    captured_at,
    source_capture_id,
    source_device,
    match_status
  )
  values (
    p_profile_id,
    p_matched_session_id,
    p_matched_participant_id,
    p_player_name,
    p_game_name,
    p_game_slug,
    p_score,
    p_hits,
    p_accuracy_percent,
    p_movement_meters,
    p_external_session_label,
    p_captured_at,
    p_source_capture_id,
    p_source_device,
    p_match_status
  )
  on conflict (source_capture_id, player_name) do nothing
  returning id into v_result_id;

  if v_result_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if p_matched_participant_id is not null then
    update public.session_participants
    set score = p_score,
        accuracy_percent = p_accuracy_percent,
        hits = p_hits,
        movement_meters = p_movement_meters,
        updated_at = now()
    where id = p_matched_participant_id
      and session_id = p_matched_session_id
      and profile_id = p_profile_id
      and deleted_at is null;

    if not found then
      raise exception 'Matched participant is no longer available.';
    end if;
  end if;

  return jsonb_build_object('id', v_result_id, 'status', 'saved');
end;
$$;

revoke all on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.service_ingest_venue_game_result(
  uuid, text, text, text, integer, integer, double precision, numeric, text,
  timestamptz, text, text, text, uuid, uuid
) to service_role;

create or replace function public.protect_session_participant_trusted_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_session record;
  v_trusted_payment_or_check_present boolean := false;
  v_trusted_payment_or_check_changed boolean := false;
  v_result_changed boolean := false;
  v_allowed_ticket_quote_insert boolean := false;
begin
  select
    s.id,
    s.owner_id,
    s.booking_type,
    s.ticket_customer_id,
    s.ticket_total_price
  into v_session
  from public.sessions s
  where s.id = new.session_id;

  if not found then
    raise exception 'Session not found.';
  end if;

  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_trusted_payment_or_check_present :=
      coalesce(new.checked_in, false) <> false
      or new.payment_status is not null
      or new.payment_amount is not null
      or coalesce(new.payment_splits, '[]'::jsonb) <> '[]'::jsonb
      or new.checked_in_at is not null;

    if not v_trusted_payment_or_check_present then
      return new;
    end if;

    v_allowed_ticket_quote_insert :=
      v_session.booking_type = 'ticket'
      and new.profile_id = v_actor
      and new.profile_id = v_session.ticket_customer_id
      and coalesce(new.checked_in, false) = false
      and new.payment_status is null
      and new.payment_amount is not distinct from v_session.ticket_total_price
      and coalesce(new.payment_splits, '[]'::jsonb) = '[]'::jsonb
      and new.checked_in_at is null;

    if v_allowed_ticket_quote_insert then
      return new;
    end if;

    if v_session.booking_type <> 'ticket'
      and public.can_manage_session_row(new.session_id)
    then
      return new;
    end if;

    raise exception 'Only session managers can set participant payment or check-in fields.';
  end if;

  v_trusted_payment_or_check_changed :=
    new.checked_in is distinct from old.checked_in
    or new.payment_status is distinct from old.payment_status
    or new.payment_amount is distinct from old.payment_amount
    or coalesce(new.payment_splits, '[]'::jsonb) is distinct from coalesce(old.payment_splits, '[]'::jsonb)
    or new.checked_in_at is distinct from old.checked_in_at;

  v_result_changed :=
    new.score is distinct from old.score
    or new.accuracy_percent is distinct from old.accuracy_percent
    or new.hits is distinct from old.hits
    or new.movement_meters is distinct from old.movement_meters
    or new.projectiles_fired is distinct from old.projectiles_fired
    or new.escape_duration_seconds is distinct from old.escape_duration_seconds
    or new.placement is distinct from old.placement
    or new.prize_claimed is distinct from old.prize_claimed
    or new.prize_claimed_at is distinct from old.prize_claimed_at;

  if not v_trusted_payment_or_check_changed and not v_result_changed then
    return new;
  end if;

  if v_session.booking_type = 'ticket' then
    raise exception 'Ticket participant payment, check-in, and result fields can only be changed by staff.';
  end if;

  if public.can_manage_session_row(new.session_id) then
    return new;
  end if;

  raise exception 'Only session managers can update participant payment, check-in, or result fields.';
end;
$$;

revoke all on function public.protect_session_participant_trusted_fields() from public, anon, authenticated;
grant execute on function public.protect_session_participant_trusted_fields() to service_role;

create or replace function public.staff_upsert_session_participant_result_v2(
  p_session_id uuid,
  p_participant_id uuid default null,
  p_profile_id uuid default null,
  p_display_name text default null,
  p_checked_in boolean default null,
  p_payment_status text default null,
  p_payment_amount integer default null,
  p_score integer default null,
  p_accuracy_percent double precision default null,
  p_hits integer default null,
  p_movement_meters numeric default null,
  p_escape_duration_seconds integer default null,
  p_placement integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_session public.sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_participant public.session_participants%rowtype;
  v_display_name text;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null;

  if not found then
    raise exception 'Session not found.';
  end if;

  if p_accuracy_percent is not null and (p_accuracy_percent < 0 or p_accuracy_percent > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_hits is not null and p_hits < 0 then
    raise exception 'Hits must be zero or higher.';
  end if;

  if p_movement_meters is not null and p_movement_meters < 0 then
    raise exception 'Movement must be zero or higher.';
  end if;

  if p_escape_duration_seconds is not null and p_escape_duration_seconds <= 0 then
    raise exception 'Escape time must be greater than 0.';
  end if;

  if p_placement is not null and p_placement < 1 then
    raise exception 'Placement must be positive.';
  end if;

  if p_participant_id is not null then
    update public.session_participants
    set checked_in = coalesce(p_checked_in, checked_in),
        payment_status = case when p_payment_status is null then payment_status else nullif(p_payment_status, '') end,
        payment_amount = p_payment_amount,
        checked_in_at = case
          when p_checked_in is true and checked_in_at is null then now()
          when p_checked_in is false then null
          else checked_in_at
        end,
        score = p_score,
        accuracy_percent = p_accuracy_percent,
        hits = p_hits,
        movement_meters = p_movement_meters,
        escape_duration_seconds = p_escape_duration_seconds,
        placement = p_placement,
        updated_at = now()
    where id = p_participant_id
      and session_id = p_session_id
      and deleted_at is null
    returning * into v_participant;

    if not found then
      raise exception 'Participant not found.';
    end if;
  else
    if p_profile_id is null then
      raise exception 'Profile id is required.';
    end if;

    select *
    into v_profile
    from public.profiles
    where id = p_profile_id
      and deleted_at is null;

    if not found then
      raise exception 'Profile not found.';
    end if;

    v_display_name := coalesce(
      nullif(btrim(p_display_name), ''),
      v_profile.nickname,
      v_profile.full_name,
      v_profile.phone,
      v_profile.email,
      'Player'
    );

    select *
    into v_participant
    from public.session_participants
    where session_id = p_session_id
      and profile_id = p_profile_id
    order by deleted_at nulls first, created_at desc
    limit 1
    for update;

    if found then
      update public.session_participants
      set deleted_at = null,
          deleted_by = null,
          delete_reason = null,
          display_name = v_display_name,
          avatar_url = v_profile.avatar_url,
          avatar_emoji = v_profile.avatar_emoji,
          avatar_initials = v_profile.avatar_initials,
          avatar_color = v_profile.avatar_color,
          avatar_text_color = v_profile.avatar_text_color,
          profile_motto = v_profile.profile_motto,
          updated_at = now()
      where id = v_participant.id
      returning * into v_participant;
    else
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
        checked_in_at
      )
      values (
        p_session_id,
        p_profile_id,
        v_display_name,
        v_profile.avatar_url,
        v_profile.avatar_emoji,
        v_profile.avatar_initials,
        v_profile.avatar_color,
        v_profile.avatar_text_color,
        v_profile.profile_motto,
        coalesce(p_checked_in, false),
        nullif(p_payment_status, ''),
        p_payment_amount,
        case when coalesce(p_checked_in, false) then now() else null end
      )
      returning * into v_participant;
    end if;
  end if;

  return jsonb_build_object('participant_id', v_participant.id, 'session_id', v_participant.session_id);
end;
$$;

revoke all on function public.staff_upsert_session_participant_result_v2(
  uuid, uuid, uuid, text, boolean, text, integer, integer, double precision, integer, numeric, integer, integer
) from public, anon;
grant execute on function public.staff_upsert_session_participant_result_v2(
  uuid, uuid, uuid, text, boolean, text, integer, integer, double precision, integer, numeric, integer, integer
) to authenticated, service_role;

do $$
begin
  if to_regprocedure(
    'public.get_leaderboard_players_page_session_only(integer,integer,text,text,uuid,uuid,text)'
  ) is null then
    alter function public.get_leaderboard_players_page(integer, integer, text, text, uuid, uuid, text)
      rename to get_leaderboard_players_page_session_only;
  end if;
end $$;

revoke all on function public.get_leaderboard_players_page_session_only(
  integer, integer, text, text, uuid, uuid, text
) from public, anon, authenticated, service_role;

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
      coalesce(nullif(trim(p_rank_by), ''), 'totalScore') as rank_by
  ),
  session_rows as (
    select *
    from public.get_leaderboard_players_page_session_only(
      5000,
      0,
      p_search,
      'totalScore',
      null,
      p_club_id,
      p_club_pin
    )
  ),
  calculated_rows as (
    select
      session_rows.profile_id,
      session_rows.display_name,
      session_rows.avatar_url,
      session_rows.avatar_emoji,
      session_rows.avatar_initials,
      session_rows.avatar_color,
      session_rows.avatar_text_color,
      session_rows.profile_motto,
      session_rows.sessions_joined,
      session_rows.games_joined,
      session_rows.wins,
      session_rows.best_performer_count,
      (
        session_rows.base_total_score
        + coalesce(unmatched_venue_totals.total_score, 0)
      )::integer as base_total_score,
      (
        session_rows.base_total_score
        + coalesce(unmatched_venue_totals.total_score, 0)
        + session_rows.score_adjustment
      )::integer as total_score,
      session_rows.score_adjustment,
      (
        session_rows.total_accuracy
        + coalesce(unmatched_venue_totals.total_accuracy, 0)
      )::double precision as total_accuracy,
      (
        session_rows.accuracy_count
        + coalesce(unmatched_venue_totals.accuracy_count, 0)
      )::integer as accuracy_count,
      (
        session_rows.total_projectiles
        + coalesce(unmatched_venue_totals.total_hits, 0)
      )::integer as total_projectiles,
      case
        when session_rows.accuracy_count + coalesce(unmatched_venue_totals.accuracy_count, 0) > 0
        then (
          session_rows.total_accuracy
          + coalesce(unmatched_venue_totals.total_accuracy, 0)
        ) / (
          session_rows.accuracy_count
          + coalesce(unmatched_venue_totals.accuracy_count, 0)
        )
        else null
      end::double precision as average_accuracy,
      session_rows.reliability_score,
      coalesce(merged_game_scores.best_by_game, session_rows.best_by_game, '[]'::jsonb) as best_by_game,
      merged_game_scores.best_escape_duration_seconds
    from session_rows
    left join lateral (
      select
        coalesce(sum(venue_results.score), 0)::integer as total_score,
        coalesce(sum(venue_results.hits), 0)::integer as total_hits,
        coalesce(sum(venue_results.accuracy_percent) filter (
          where venue_results.accuracy_percent is not null
        ), 0)::double precision as total_accuracy,
        count(venue_results.accuracy_percent) filter (
          where venue_results.accuracy_percent is not null
        )::integer as accuracy_count
      from public.venue_game_results venue_results
      where venue_results.profile_id = session_rows.profile_id
        and venue_results.matched_participant_id is null
    ) unmatched_venue_totals on true
    left join lateral (
      select
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'game',
            combined_scores.game_slug,
            'score',
            combined_scores.best_score,
            'escapeDurationSeconds',
            combined_scores.best_escape_duration_seconds
          ))
          order by
            combined_scores.best_escape_duration_seconds asc nulls last,
            combined_scores.best_score desc,
            combined_scores.game_slug
        ) as best_by_game,
        min(combined_scores.best_escape_duration_seconds) filter (
          where combined_scores.best_escape_duration_seconds is not null
        )::integer as best_escape_duration_seconds
      from (
        select
          score_rows.game_slug,
          max(score_rows.score)::integer as best_score,
          min(score_rows.escape_duration_seconds) filter (
            where score_rows.escape_duration_seconds is not null
              and score_rows.escape_duration_seconds > 0
          )::integer as best_escape_duration_seconds
        from (
          select
            nullif(session_score ->> 'game', '') as game_slug,
            nullif(session_score ->> 'score', '')::integer as score,
            nullif(session_score ->> 'escapeDurationSeconds', '')::integer as escape_duration_seconds
          from jsonb_array_elements(coalesce(session_rows.best_by_game, '[]'::jsonb)) session_score
          where nullif(session_score ->> 'game', '') is not null
            and nullif(session_score ->> 'score', '') is not null

          union all

          select
            venue_results.game_slug,
            venue_results.score,
            null::integer as escape_duration_seconds
          from public.venue_game_results venue_results
          where venue_results.profile_id = session_rows.profile_id
            and venue_results.game_slug is not null
        ) score_rows
        group by score_rows.game_slug
      ) combined_scores
    ) merged_game_scores on true
  ),
  metric_rows as (
    select
      calculated_rows.*,
      case normalized_args.rank_by
        when 'wins' then calculated_rows.wins::double precision
        when 'winRate' then case
          when calculated_rows.games_joined > 0
          then (
            calculated_rows.wins::double precision
            / calculated_rows.games_joined::double precision
          ) * 100
          else 0
        end
        when 'accuracy' then coalesce(calculated_rows.average_accuracy, 0)
        when 'reliability' then calculated_rows.reliability_score
        when 'projectiles' then calculated_rows.total_projectiles::double precision
        when 'gamesPlayed' then calculated_rows.games_joined::double precision
        when 'escapeTime' then coalesce(calculated_rows.best_escape_duration_seconds, 0)::double precision
        else calculated_rows.total_score::double precision
      end as metric_value
    from calculated_rows
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
          metric_rows.best_performer_count desc,
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
    end::double precision as leaderboard_higher_metric_value,
    ranked_rows.metric_value::double precision as leaderboard_metric_value,
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

revoke all on function public.get_leaderboard_players_page(
  integer, integer, text, text, uuid, uuid, text
) from public;
grant execute on function public.get_leaderboard_players_page(
  integer, integer, text, text, uuid, uuid, text
) to anon, authenticated, service_role;

create or replace function public.get_leaderboard_players_page_v2(
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
  base_rows as (
    select *
    from public.get_leaderboard_players_page(
      5000,
      0,
      p_search,
      'totalScore',
      null,
      p_club_id,
      p_club_pin
    )
  ),
  result_rows as (
    select
      participants.profile_id,
      coalesce(sessions.confirmed_game_id, sessions.game_options[1]) as game_slug,
      participants.score,
      participants.hits,
      participants.accuracy_percent,
      participants.movement_meters::double precision as movement_meters
    from public.session_participants participants
    join public.sessions sessions
      on sessions.id = participants.session_id
    where participants.deleted_at is null
      and sessions.deleted_at is null
      and sessions.status <> 'cancelled'
      and coalesce(sessions.confirmed_game_id, sessions.game_options[1]) is not null
      and (
        participants.score is not null
        or participants.hits is not null
        or participants.accuracy_percent is not null
        or participants.movement_meters is not null
      )
      and not exists (
        select 1
        from public.venue_game_results linked_result
        where linked_result.matched_participant_id = participants.id
      )

    union all

    select
      venue_results.profile_id,
      venue_results.game_slug,
      venue_results.score,
      venue_results.hits,
      venue_results.accuracy_percent,
      venue_results.movement_meters::double precision
    from public.venue_game_results venue_results
    where venue_results.game_slug is not null
  ),
  game_stats as (
    select
      result_rows.profile_id,
      result_rows.game_slug,
      coalesce(sum(result_rows.score), 0)::integer as total_score,
      coalesce(sum(result_rows.hits), 0)::integer as total_hits,
      coalesce(sum(result_rows.movement_meters), 0)::double precision as total_movement_meters,
      coalesce(sum(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      ), 0)::double precision as total_accuracy,
      count(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      )::integer as accuracy_count,
      count(*)::integer as result_count
    from result_rows
    group by result_rows.profile_id, result_rows.game_slug
  ),
  overall_stats as (
    select
      result_rows.profile_id,
      coalesce(sum(result_rows.score), 0)::integer as total_score,
      coalesce(sum(result_rows.hits), 0)::integer as total_hits,
      coalesce(sum(result_rows.movement_meters), 0)::double precision as total_movement_meters,
      coalesce(sum(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      ), 0)::double precision as total_accuracy,
      count(result_rows.accuracy_percent) filter (
        where result_rows.accuracy_percent is not null
      )::integer as accuracy_count,
      count(*)::integer as result_count
    from result_rows
    group by result_rows.profile_id
  ),
  scoped_rows as (
    select
      base_rows.profile_id,
      base_rows.display_name,
      base_rows.avatar_url,
      base_rows.avatar_emoji,
      base_rows.avatar_initials,
      base_rows.avatar_color,
      base_rows.avatar_text_color,
      base_rows.profile_motto,
      base_rows.sessions_joined,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.result_count, 0)
        else coalesce(selected_game_stats.result_count, 0)
      end::integer as games_joined,
      base_rows.wins,
      base_rows.best_performer_count,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_score, 0)
        else coalesce(selected_game_stats.total_score, 0)
      end::integer as base_total_score,
      case
        when normalized_args.game_id is null
          then coalesce(overall_stats.total_score, 0) + base_rows.score_adjustment
        else coalesce(selected_game_stats.total_score, 0)
      end::integer as total_score,
      case
        when normalized_args.game_id is null then base_rows.score_adjustment
        else 0
      end::integer as score_adjustment,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_accuracy, 0)
        else coalesce(selected_game_stats.total_accuracy, 0)
      end::double precision as total_accuracy,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.accuracy_count, 0)
        else coalesce(selected_game_stats.accuracy_count, 0)
      end::integer as accuracy_count,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_hits, 0)
        else coalesce(selected_game_stats.total_hits, 0)
      end::integer as total_projectiles,
      case
        when normalized_args.game_id is null then coalesce(overall_stats.total_movement_meters, 0)
        else coalesce(selected_game_stats.total_movement_meters, 0)
      end::double precision as total_movement_meters,
      case
        when normalized_args.game_id is null and coalesce(overall_stats.accuracy_count, 0) > 0
          then overall_stats.total_accuracy / overall_stats.accuracy_count
        when coalesce(selected_game_stats.accuracy_count, 0) > 0
        then selected_game_stats.total_accuracy / selected_game_stats.accuracy_count
        else null
      end::double precision as average_accuracy,
      base_rows.reliability_score,
      base_rows.best_by_game
    from base_rows
    cross join normalized_args
    left join game_stats selected_game_stats
      on selected_game_stats.profile_id = base_rows.profile_id
     and selected_game_stats.game_slug = normalized_args.game_id
    left join overall_stats
      on overall_stats.profile_id = base_rows.profile_id
  ),
  metric_rows as (
    select
      scoped_rows.*,
      case normalized_args.rank_by
        when 'wins' then scoped_rows.wins::double precision
        when 'winRate' then case
          when scoped_rows.games_joined > 0
          then (scoped_rows.wins::double precision / scoped_rows.games_joined::double precision) * 100
          else 0
        end
        when 'accuracy' then coalesce(scoped_rows.average_accuracy, 0)
        when 'reliability' then scoped_rows.reliability_score
        when 'projectiles' then scoped_rows.total_projectiles::double precision
        when 'hits' then scoped_rows.total_projectiles::double precision
        when 'movement' then scoped_rows.total_movement_meters
        when 'gamesPlayed' then scoped_rows.games_joined::double precision
        when 'escapeTime' then coalesce((
          select min(nullif(game_score ->> 'escapeDurationSeconds', '')::double precision)
          from jsonb_array_elements(coalesce(scoped_rows.best_by_game, '[]'::jsonb)) game_score
          where nullif(game_score ->> 'escapeDurationSeconds', '') is not null
            and (
              normalized_args.game_id is null
              or game_score ->> 'game' = normalized_args.game_id
            )
        ), 0)
        else scoped_rows.total_score::double precision
      end as metric_value
    from scoped_rows
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

revoke all on function public.get_leaderboard_players_page_v2(
  integer, integer, text, text, uuid, uuid, text, text
) from public;
grant execute on function public.get_leaderboard_players_page_v2(
  integer, integer, text, text, uuid, uuid, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
