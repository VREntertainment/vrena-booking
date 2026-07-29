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
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_session public.sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_participant public.session_participants%rowtype;
  v_display_name text;
  v_checked_in boolean;
  v_avatar_url text;
  v_avatar_emoji text;
  v_avatar_initials text;
  v_avatar_color text;
  v_avatar_text_color text;
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

    v_display_name := case
      when coalesce(v_profile.anonymous_mode, false) then
        public.profile_public_display_name(
          v_profile.id,
          v_profile.nickname,
          v_profile.full_name,
          v_profile.phone,
          v_profile.anonymous_mode,
          v_profile.anonymous_callsign
        )
      else coalesce(
        nullif(btrim(p_display_name), ''),
        public.profile_public_display_name(
          v_profile.id,
          v_profile.nickname,
          v_profile.full_name,
          v_profile.phone,
          v_profile.anonymous_mode,
          v_profile.anonymous_callsign
        ),
        v_profile.email,
        'Player'
      )
    end;

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

    v_checked_in := case
      when p_checked_in is not null then p_checked_in
      when v_session.status <> 'cancelled'
        and v_session.date::timestamp + v_session.start_time
          <= timezone('Asia/Ho_Chi_Minh', now())
      then true
      else null
    end;

    select *
    into v_participant
    from public.session_participants
    where session_id = p_session_id
      and profile_id = p_profile_id
    order by deleted_at nulls first, joined_at desc, id desc
    limit 1
    for update;

    if found then
      update public.session_participants
      set deleted_at = null,
          deleted_by = null,
          delete_reason = null,
          display_name = v_display_name,
          avatar_url = v_avatar_url,
          avatar_emoji = v_avatar_emoji,
          avatar_initials = v_avatar_initials,
          avatar_color = v_avatar_color,
          avatar_text_color = v_avatar_text_color,
          profile_motto = v_profile.profile_motto,
          checked_in = coalesce(v_checked_in, checked_in),
          checked_in_at = case
            when v_checked_in is true and checked_in_at is null then now()
            when v_checked_in is false then null
            else checked_in_at
          end,
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
        v_avatar_url,
        v_avatar_emoji,
        v_avatar_initials,
        v_avatar_color,
        v_avatar_text_color,
        v_profile.profile_motto,
        coalesce(v_checked_in, false),
        nullif(p_payment_status, ''),
        p_payment_amount,
        case when coalesce(v_checked_in, false) then now() else null end
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

update public.session_participants participant
set display_name = public.profile_public_display_name(
      profile.id,
      profile.nickname,
      profile.full_name,
      profile.phone,
      profile.anonymous_mode,
      profile.anonymous_callsign
    ),
    avatar_url = null,
    avatar_emoji = '🎭',
    avatar_initials = null,
    avatar_color = '#11181b',
    avatar_text_color = '#ffffff',
    profile_motto = profile.profile_motto,
    updated_at = now()
from public.profiles profile
where profile.id = participant.profile_id
  and profile.deleted_at is null
  and profile.anonymous_mode is true
  and participant.deleted_at is null
  and (
    participant.display_name is distinct from public.profile_public_display_name(
      profile.id,
      profile.nickname,
      profile.full_name,
      profile.phone,
      profile.anonymous_mode,
      profile.anonymous_callsign
    )
    or participant.avatar_url is not null
    or participant.avatar_emoji is distinct from '🎭'
    or participant.avatar_initials is not null
    or participant.avatar_color is distinct from '#11181b'
    or participant.avatar_text_color is distinct from '#ffffff'
    or participant.profile_motto is distinct from profile.profile_motto
  );
