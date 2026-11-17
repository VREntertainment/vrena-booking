-- Keep all existing privacy rules. Scope the bounded session set once, then join
-- participants/waitlists through those sessions. Their profile IDs therefore
-- already satisfy staff_location_profile_allowed via an allowed-venue visit.
CREATE OR REPLACE FUNCTION public.sessions_list_page(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 120, p_offset integer DEFAULT 0, p_include_blocked_times boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_scoped boolean := v_actor_rank between 20 and 99;
  v_allowed_venues text[];
  v_sessions jsonb := '[]'::jsonb;
  v_score_adjustments jsonb := '{}'::jsonb;
  v_blocked_times jsonb := '[]'::jsonb;
  v_has_more_after boolean := false;
begin
  -- Resolve the authenticated PIN actor's assigned venues once per request.
  if v_scoped then
    select coalesce(array_agg(l.venue_key), '{}'::text[]) into v_allowed_venues
    from public.staff_access_locations() l;
  end if;
  with selected_sessions as materialized (
    select s.*
    from public.sessions s
    where s.deleted_at is null
      and (not v_scoped or s.venue_key = any(v_allowed_venues))
      and s.status <> 'cancelled'
      and (p_start_date is null or s.date >= p_start_date)
      and (p_end_date is null or s.date <= p_end_date)
      and (
        s.visibility = 'public'
        or (s.visibility = 'private' and s.booking_type <> 'ticket')
        or s.booking_type = 'ticket'
        or s.owner_id = v_actor
        or v_actor_rank >= 50
        or exists (
          select 1
          from public.session_participants sp
          where sp.session_id = s.id
            and sp.profile_id = v_actor
            and sp.deleted_at is null
        )
        or exists (
          select 1
          from public.session_invites si
          where si.session_id = s.id
            and si.recipient_id = v_actor
        )
      )
    order by s.date asc, s.start_time asc, s.id asc
    limit v_limit
    offset v_offset
  ),
  participant_rows as (
    select
      sp.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'profile_id', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.profile_id else null end,
          'display_name', sp.display_name,
          'avatar_url', sp.avatar_url,
          'avatar_emoji', sp.avatar_emoji,
          'avatar_initials', sp.avatar_initials,
          'avatar_color', sp.avatar_color,
          'avatar_text_color', sp.avatar_text_color,
          'profile_motto', sp.profile_motto,
          'checked_in', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.checked_in else null end
        )
        order by sp.id
      ) as session_participants
    from public.session_participants sp
    join selected_sessions s on s.id = sp.session_id
    where sp.deleted_at is null
      and (
        s.booking_type is distinct from 'ticket'
        or v_actor_rank >= 50
        or sp.profile_id = v_actor
        or s.owner_id = v_actor
      )
    group by sp.session_id
  ),
  waitlist_rows as (
    select
      sw.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.id else null end,
          'session_id', sw.session_id,
          'profile_id', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.profile_id else null end,
          'created_at', sw.created_at
        )
        order by sw.created_at asc, sw.id
      ) as session_waitlist
    from public.session_waitlist sw
    join selected_sessions s on s.id = sw.session_id
    where v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor
    group by sw.session_id
  ),
  participant_profile_ids as (
    select distinct sp.profile_id
    from public.session_participants sp
    join selected_sessions s on s.id = sp.session_id
    where sp.deleted_at is null
      and (v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor)
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'venue_key', s.venue_key,
        'owner_id', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.owner_id else null end,
        'club_id', s.club_id,
        'session_type', s.session_type,
        'name', s.name,
        'date', s.date,
        'start_time', s.start_time,
        'duration_minutes', s.duration_minutes,
        'max_players', s.max_players,
        'arena_count', s.arena_count,
        'game_options', s.game_options,
        'game_votes', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.game_votes else '{}'::jsonb end,
        'confirmed_game_id', s.confirmed_game_id,
        'visibility', s.visibility,
        'invite_code', case
          when v_actor_rank >= 50
            or s.owner_id = v_actor
            or exists (
              select 1
              from public.session_participants joined_participant
              where joined_participant.session_id = s.id
                and joined_participant.profile_id = v_actor
                and joined_participant.deleted_at is null
            )
          then s.invite_code
          else null
        end,
        'status', s.status,
        'rounds_per_match', s.rounds_per_match,
        'seeded', s.seeded,
        'seed_label', s.seed_label,
        'booking_type', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end,
        'ticket_type', case when s.booking_type = 'ticket' or v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end,
        'ticket_player_count', s.ticket_player_count,
        'challenge_target_id', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_target_id else null end,
        'challenge_status', s.challenge_status,
        'session_participants', coalesce(pr.session_participants, '[]'::jsonb),
        'session_waitlist', coalesce(wr.session_waitlist, '[]'::jsonb)
      )
      order by s.date asc, s.start_time asc, s.id asc
    ), '[]'::jsonb),
    coalesce((
      select jsonb_object_agg(p.id::text, coalesce(p.score_adjustment, 0))
      from public.profiles p
      join participant_profile_ids ids on ids.profile_id = p.id
      where p.deleted_at is null
    ), '{}'::jsonb)
  into v_sessions, v_score_adjustments
  from selected_sessions s
  left join participant_rows pr on pr.session_id = s.id
  left join waitlist_rows wr on wr.session_id = s.id;

  if p_end_date is not null then
    select exists (
      select 1
      from public.sessions s
      where s.deleted_at is null
      and (not v_scoped or s.venue_key = any(v_allowed_venues))
        and s.status <> 'cancelled'
        and s.date > p_end_date
    )
    into v_has_more_after;
  end if;

  if p_include_blocked_times and v_actor_rank >= 50
    and (not v_scoped or 'ha-do-centrosa' = any(v_allowed_venues)) then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', bt.date,
        'start_time', bt.start_time,
        'end_time', bt.end_time,
        'arenas_used', bt.arenas_used
      )
      order by bt.date asc, bt.start_time asc
    ), '[]'::jsonb)
    into v_blocked_times
    from public.blocked_times bt
    where (p_start_date is null or bt.date >= p_start_date)
      and (p_end_date is null or bt.date <= p_end_date);
  end if;

  return jsonb_build_object(
    'sessions', coalesce(v_sessions, '[]'::jsonb),
    'scoreAdjustments', coalesce(v_score_adjustments, '{}'::jsonb),
    'blockedTimes', coalesce(v_blocked_times, '[]'::jsonb),
    'hasMoreAfter', coalesce(v_has_more_after, false),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$function$
;
