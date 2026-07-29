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
      staff_games.name as game_name
    from public.sessions
    left join public.staff_games on staff_games.slug = sessions.confirmed_game_id
    where sessions.deleted_at is null
      and sessions.date >= v_month_start
      and sessions.date < (v_month_start + interval '1 month')::date
  ) session_row;

  return v_sessions;
end;
$function$;

revoke all on function public.staff_list_player_session_options(uuid, date) from public;
revoke all on function public.staff_list_player_session_options(uuid, date) from anon;
grant execute on function public.staff_list_player_session_options(uuid, date) to authenticated;
