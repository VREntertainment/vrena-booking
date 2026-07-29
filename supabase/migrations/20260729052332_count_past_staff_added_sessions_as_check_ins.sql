create or replace function public.staff_save_player_achievement_profile_v3(
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
  v_result jsonb;
  v_session_id uuid;
  v_before_checked_in boolean;
begin
  v_result := public.staff_save_player_achievement_profile_v2(
    p_profile_id,
    p_loyalty_points,
    p_overall,
    p_games,
    p_achievement_changes,
    p_note,
    p_session_ids
  );

  for v_session_id in
    select distinct sessions.id
    from unnest(coalesce(p_session_ids, array[]::uuid[])) as requested(session_id)
    join public.sessions
      on sessions.id = requested.session_id
      and sessions.deleted_at is null
      and sessions.status <> 'cancelled'
    where sessions.date::timestamp + sessions.start_time
      <= timezone('Asia/Ho_Chi_Minh', now())
  loop
    select participant.checked_in
    into v_before_checked_in
    from public.session_participants participant
    where participant.session_id = v_session_id
      and participant.profile_id = p_profile_id
      and participant.deleted_at is null
    order by participant.joined_at desc, participant.id desc
    limit 1;

    perform public.staff_upsert_session_participant_result_v2(
      p_session_id := v_session_id,
      p_profile_id := p_profile_id,
      p_checked_in := true
    );

    if v_before_checked_in is distinct from true then
      insert into public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value
      )
      values (
        auth.uid(),
        'player_session_check_in_backfilled',
        'session_participants',
        v_session_id,
        jsonb_build_object(
          'checkedIn', coalesce(v_before_checked_in, false),
          'profileId', p_profile_id,
          'sessionId', v_session_id
        ),
        jsonb_build_object(
          'checkedIn', true,
          'profileId', p_profile_id,
          'sessionId', v_session_id
        )
      );
    end if;
  end loop;

  return v_result;
end;
$function$;

revoke all on function public.staff_save_player_achievement_profile_v3(
  uuid,
  integer,
  jsonb,
  jsonb,
  jsonb,
  text,
  uuid[]
) from public;
revoke all on function public.staff_save_player_achievement_profile_v3(
  uuid,
  integer,
  jsonb,
  jsonb,
  jsonb,
  text,
  uuid[]
) from anon;
grant execute on function public.staff_save_player_achievement_profile_v3(
  uuid,
  integer,
  jsonb,
  jsonb,
  jsonb,
  text,
  uuid[]
) to authenticated;
