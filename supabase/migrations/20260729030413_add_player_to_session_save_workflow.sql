create or replace function public.staff_list_player_session_options(
  p_profile_id uuid,
  p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_month_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_sessions jsonb;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null or not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'alreadyAdded',
      session_row.owner_id = p_profile_id
      or exists (
        select 1
        from public.session_participants participant
        where participant.session_id = session_row.id
          and participant.profile_id = p_profile_id
          and participant.deleted_at is null
      ),
    'bookingType', session_row.booking_type,
    'date', session_row.date,
    'gameName', session_row.game_name,
    'id', session_row.id,
    'name', session_row.name,
    'startTime', session_row.start_time,
    'status', session_row.status,
    'ticketType', session_row.ticket_type
  ) order by session_row.date, session_row.start_time, session_row.name), '[]'::jsonb)
  into v_sessions
  from (
    select
      sessions.id,
      sessions.owner_id,
      sessions.name,
      sessions.date,
      sessions.start_time,
      sessions.status,
      sessions.booking_type,
      sessions.ticket_type,
      games.name as game_name
    from public.sessions
    left join public.games on games.id = sessions.confirmed_game_id
    where sessions.deleted_at is null
      and sessions.date >= v_month_start
      and sessions.date < (v_month_start + interval '1 month')::date
  ) session_row;

  return v_sessions;
end;
$function$;

create or replace function public.staff_save_player_achievement_profile_v2(
  p_profile_id uuid,
  p_loyalty_points integer,
  p_overall jsonb,
  p_games jsonb,
  p_achievement_changes jsonb default '[]'::jsonb,
  p_note text default null,
  p_session_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_change jsonb;
  v_action text;
  v_id text;
  v_kind text;
  v_title text;
  v_description text;
  v_session_id uuid;
  v_before_stats jsonb;
  v_before_awards jsonb;
  v_before_sessions jsonb;
  v_after_stats jsonb;
  v_after_awards jsonb;
  v_after_sessions jsonb;
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null or not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Staff note is too long.';
  end if;

  if p_achievement_changes is null or jsonb_typeof(p_achievement_changes) <> 'array' then
    raise exception 'Achievement changes must be an array.';
  end if;

  if jsonb_array_length(p_achievement_changes) > 100 then
    raise exception 'Too many achievement changes.';
  end if;

  if p_session_ids is null or cardinality(p_session_ids) > 50 then
    raise exception 'Choose up to 50 valid sessions.';
  end if;

  if exists (
    select 1
    from unnest(p_session_ids) as requested(requested_session_id)
    left join public.sessions requested_session
      on requested_session.id = requested.requested_session_id
      and requested_session.deleted_at is null
      and requested_session.status <> 'cancelled'
    where requested_session.id is null
  ) then
    raise exception 'One or more selected sessions are unavailable.';
  end if;

  v_before_stats := public.staff_get_player_stat_overrides(p_profile_id);

  select coalesce(jsonb_agg(to_jsonb(award) order by award.awarded_at), '[]'::jsonb)
  into v_before_awards
  from public.profile_achievement_awards award
  where award.profile_id = p_profile_id
    and award.revoked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sessions.id,
    'date', sessions.date,
    'startTime', sessions.start_time,
    'name', sessions.name
  ) order by sessions.date, sessions.start_time), '[]'::jsonb)
  into v_before_sessions
  from public.sessions
  where sessions.deleted_at is null
    and (
      sessions.owner_id = p_profile_id
      or exists (
        select 1
        from public.session_participants participant
        where participant.session_id = sessions.id
          and participant.profile_id = p_profile_id
          and participant.deleted_at is null
      )
    );

  v_after_stats := public.staff_set_player_stat_overrides(
    p_profile_id,
    p_loyalty_points,
    p_overall,
    p_games
  );

  for v_change in
    select value from jsonb_array_elements(p_achievement_changes)
  loop
    v_action := lower(nullif(btrim(v_change ->> 'action'), ''));
    v_id := nullif(btrim(v_change ->> 'id'), '');
    v_kind := lower(nullif(btrim(v_change ->> 'kind'), ''));
    v_title := nullif(btrim(v_change ->> 'title'), '');
    v_description := nullif(btrim(v_change ->> 'description'), '');

    if v_action not in ('unlock', 'remove')
      or v_kind not in ('game', 'retention')
      or v_id is null
      or char_length(v_id) > 120
    then
      raise exception 'Choose a valid achievement change.';
    end if;

    if v_action = 'unlock' then
      if v_title is null or char_length(v_title) > 160 then
        raise exception 'Achievement title is required.';
      end if;

      if v_description is not null and char_length(v_description) > 500 then
        raise exception 'Achievement description is too long.';
      end if;

      if not exists (
        select 1
        from public.profile_achievement_awards award
        where award.profile_id = p_profile_id
          and award.achievement_kind = v_kind
          and award.achievement_id = v_id
          and award.revoked_at is null
      ) then
        insert into public.profile_achievement_awards (
          profile_id,
          achievement_id,
          achievement_kind,
          title,
          description,
          note,
          awarded_by
        )
        values (
          p_profile_id,
          v_id,
          v_kind,
          v_title,
          v_description,
          v_note,
          v_actor
        );
      end if;
    else
      update public.profile_achievement_awards
      set revoked_by = v_actor,
          revoked_at = now(),
          note = coalesce(v_note, note),
          updated_at = now()
      where profile_id = p_profile_id
        and achievement_kind = v_kind
        and achievement_id = v_id
        and revoked_at is null;
    end if;
  end loop;

  for v_session_id in
    select distinct requested.requested_session_id
    from unnest(p_session_ids) as requested(requested_session_id)
  loop
    perform public.staff_upsert_session_participant_result_v2(
      p_session_id := v_session_id,
      p_profile_id := p_profile_id
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(award) order by award.awarded_at), '[]'::jsonb)
  into v_after_awards
  from public.profile_achievement_awards award
  where award.profile_id = p_profile_id
    and award.revoked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sessions.id,
    'date', sessions.date,
    'startTime', sessions.start_time,
    'name', sessions.name
  ) order by sessions.date, sessions.start_time), '[]'::jsonb)
  into v_after_sessions
  from public.sessions
  where sessions.deleted_at is null
    and (
      sessions.owner_id = p_profile_id
      or exists (
        select 1
        from public.session_participants participant
        where participant.session_id = sessions.id
          and participant.profile_id = p_profile_id
          and participant.deleted_at is null
      )
    );

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
    'player_achievement_profile_updated',
    'profiles',
    p_profile_id,
    jsonb_build_object(
      'stats', v_before_stats,
      'manualAchievements', v_before_awards,
      'sessions', v_before_sessions
    ),
    jsonb_build_object(
      'note', v_note,
      'stats', v_after_stats,
      'manualAchievements', v_after_awards,
      'sessions', v_after_sessions
    )
  );

  return jsonb_build_object(
    'profileId', p_profile_id,
    'stats', v_after_stats,
    'manualAchievements', v_after_awards,
    'sessions', v_after_sessions
  );
end;
$function$;

create or replace function public.staff_save_player_achievement_profile(
  p_profile_id uuid,
  p_loyalty_points integer,
  p_overall jsonb,
  p_games jsonb,
  p_achievement_changes jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.staff_save_player_achievement_profile_v2(
    p_profile_id,
    p_loyalty_points,
    p_overall,
    p_games,
    p_achievement_changes,
    p_note,
    array[]::uuid[]
  );
end;
$function$;

revoke all on function public.staff_list_player_session_options(uuid, date) from public;
revoke all on function public.staff_list_player_session_options(uuid, date) from anon;
grant execute on function public.staff_list_player_session_options(uuid, date) to authenticated;

revoke all on function public.staff_save_player_achievement_profile_v2(uuid, integer, jsonb, jsonb, jsonb, text, uuid[]) from public;
revoke all on function public.staff_save_player_achievement_profile_v2(uuid, integer, jsonb, jsonb, jsonb, text, uuid[]) from anon;
grant execute on function public.staff_save_player_achievement_profile_v2(uuid, integer, jsonb, jsonb, jsonb, text, uuid[]) to authenticated;
