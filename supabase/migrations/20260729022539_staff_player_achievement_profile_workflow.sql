create or replace function public.staff_get_player_achievement_history(
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_sessions jsonb;
  v_results jsonb;
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

  select coalesce(jsonb_agg(session_row.payload order by session_row.session_date, session_row.start_time), '[]'::jsonb)
  into v_sessions
  from (
    select
      sessions.date as session_date,
      sessions.start_time,
      jsonb_build_object(
        'booking_type', sessions.booking_type,
        'challenge_status', sessions.challenge_status,
        'challenge_target_id', sessions.challenge_target_id,
        'club_id', sessions.club_id,
        'confirmed_game_id', sessions.confirmed_game_id,
        'date', sessions.date,
        'game_options', sessions.game_options,
        'owner_id', sessions.owner_id,
        'start_time', sessions.start_time,
        'status', sessions.status,
        'ticket_type', sessions.ticket_type,
        'session_participants', coalesce((
          select jsonb_agg(jsonb_build_object(
            'accuracy_percent', participant.accuracy_percent,
            'checked_in', participant.checked_in,
            'escape_duration_seconds', participant.escape_duration_seconds,
            'placement', participant.placement,
            'profile_id', participant.profile_id,
            'score', participant.score
          ) order by participant.joined_at)
          from public.session_participants participant
          where participant.session_id = sessions.id
            and participant.deleted_at is null
        ), '[]'::jsonb)
      ) as payload
    from public.sessions
    where sessions.deleted_at is null
      and (
        sessions.owner_id = p_profile_id
        or exists (
          select 1
          from public.session_participants selected_participant
          where selected_participant.session_id = sessions.id
            and selected_participant.profile_id = p_profile_id
            and selected_participant.deleted_at is null
        )
      )
    order by sessions.date, sessions.start_time
    limit 500
  ) session_row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'accuracy_percent', result.accuracy_percent,
    'captured_at', result.captured_at,
    'game_slug', result.game_slug,
    'id', result.id,
    'matched_participant_id', result.matched_participant_id,
    'score', result.score
  ) order by result.captured_at), '[]'::jsonb)
  into v_results
  from public.venue_game_results result
  where result.profile_id = p_profile_id;

  return jsonb_build_object(
    'profileId', p_profile_id,
    'sessions', v_sessions,
    'venueResults', v_results
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
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_change jsonb;
  v_action text;
  v_id text;
  v_kind text;
  v_title text;
  v_description text;
  v_before_stats jsonb;
  v_before_awards jsonb;
  v_after_stats jsonb;
  v_after_awards jsonb;
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

  v_before_stats := public.staff_get_player_stat_overrides(p_profile_id);

  select coalesce(jsonb_agg(to_jsonb(award) order by award.awarded_at), '[]'::jsonb)
  into v_before_awards
  from public.profile_achievement_awards award
  where award.profile_id = p_profile_id
    and award.revoked_at is null;

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

  select coalesce(jsonb_agg(to_jsonb(award) order by award.awarded_at), '[]'::jsonb)
  into v_after_awards
  from public.profile_achievement_awards award
  where award.profile_id = p_profile_id
    and award.revoked_at is null;

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
      'manualAchievements', v_before_awards
    ),
    jsonb_build_object(
      'note', v_note,
      'stats', v_after_stats,
      'manualAchievements', v_after_awards
    )
  );

  return jsonb_build_object(
    'profileId', p_profile_id,
    'stats', v_after_stats,
    'manualAchievements', v_after_awards
  );
end;
$function$;

revoke all on function public.staff_get_player_achievement_history(uuid) from public;
revoke all on function public.staff_get_player_achievement_history(uuid) from anon;
grant execute on function public.staff_get_player_achievement_history(uuid) to authenticated;

revoke all on function public.staff_save_player_achievement_profile(uuid, integer, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.staff_save_player_achievement_profile(uuid, integer, jsonb, jsonb, jsonb, text) from anon;
grant execute on function public.staff_save_player_achievement_profile(uuid, integer, jsonb, jsonb, jsonb, text) to authenticated;
