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

do $backfill$
declare
  v_previous_claim_role text := current_setting('request.jwt.claim.role', true);
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  with staff_added_sessions as (
  select distinct on (audit.entity_id, new_session.value ->> 'id')
    audit.actor_user_id,
    audit.entity_id as profile_id,
    (new_session.value ->> 'id')::uuid as session_id
  from public.audit_logs audit
  cross join lateral jsonb_array_elements(
    coalesce(audit.new_value -> 'sessions', '[]'::jsonb)
  ) as new_session(value)
  where audit.action = 'player_achievement_profile_updated'
    and jsonb_typeof(audit.old_value -> 'sessions') = 'array'
    and jsonb_typeof(audit.new_value -> 'sessions') = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(audit.old_value -> 'sessions') as old_session(value)
      where old_session.value ->> 'id' = new_session.value ->> 'id'
    )
  order by audit.entity_id, new_session.value ->> 'id', audit.created_at
),
eligible_participants as (
  select
    participant.id as participant_id,
    staff_added.actor_user_id,
    staff_added.profile_id,
    staff_added.session_id
  from staff_added_sessions staff_added
  join public.sessions session_row
    on session_row.id = staff_added.session_id
    and session_row.deleted_at is null
    and session_row.status <> 'cancelled'
    and session_row.date::timestamp + session_row.start_time
      <= timezone('Asia/Ho_Chi_Minh', now())
  join public.session_participants participant
    on participant.session_id = staff_added.session_id
    and participant.profile_id = staff_added.profile_id
    and participant.deleted_at is null
    and participant.checked_in is not true
),
updated_participants as (
  update public.session_participants participant
  set checked_in = true,
      checked_in_at = coalesce(participant.checked_in_at, now()),
      updated_at = now()
  from eligible_participants eligible
  where participant.id = eligible.participant_id
  returning
    participant.id,
    eligible.actor_user_id,
    eligible.profile_id,
    eligible.session_id
)
insert into public.audit_logs (
  actor_user_id,
  action,
  entity_type,
  entity_id,
  old_value,
  new_value
)
select
  updated.actor_user_id,
  'player_session_check_in_backfilled',
  'session_participants',
  updated.session_id,
  jsonb_build_object(
    'checkedIn', false,
    'profileId', updated.profile_id,
    'sessionId', updated.session_id
  ),
  jsonb_build_object(
    'checkedIn', true,
    'profileId', updated.profile_id,
    'sessionId', updated.session_id
  )
  from updated_participants updated;

  perform set_config(
    'request.jwt.claim.role',
    coalesce(v_previous_claim_role, ''),
    true
  );
end;
$backfill$;
