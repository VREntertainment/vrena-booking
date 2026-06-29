begin;

create or replace function public.can_manage_session_row(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_staff_role_rank(), 0) >= 50
    or exists (
      select 1
      from public.sessions s
      where s.id = p_session_id
        and s.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.tournament_editors te
      where te.session_id = p_session_id
        and te.profile_id = (select auth.uid())
    );
$$;

create or replace function public.can_view_session_row(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1
      from public.sessions s
      where s.id = p_session_id
        and s.deleted_at is null
        and s.status <> 'cancelled'
        and s.visibility = 'public'
    )
    or public.can_manage_session_row(p_session_id)
    or exists (
      select 1
      from public.session_participants sp
      where sp.session_id = p_session_id
        and sp.profile_id = (select auth.uid())
        and sp.deleted_at is null
    )
    or exists (
      select 1
      from public.session_invites si
      where si.session_id = p_session_id
        and si.recipient_id = (select auth.uid())
    );
$$;

create or replace function public.protect_session_client_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_can_manage boolean := public.can_manage_session_row(old.id);
begin
  if v_is_service_role or v_can_manage then
    return new;
  end if;

  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if not exists (
    select 1
    from public.session_participants sp
    where sp.session_id = old.id
      and sp.profile_id = v_actor
      and sp.deleted_at is null
  ) then
    raise exception 'Session participant access required.';
  end if;

  if new.game_votes is distinct from old.game_votes
    and new.owner_id is not distinct from old.owner_id
    and new.club_id is not distinct from old.club_id
    and new.session_type is not distinct from old.session_type
    and new.name is not distinct from old.name
    and new.date is not distinct from old.date
    and new.start_time is not distinct from old.start_time
    and new.duration_minutes is not distinct from old.duration_minutes
    and new.max_players is not distinct from old.max_players
    and new.arena_count is not distinct from old.arena_count
    and new.game_options is not distinct from old.game_options
    and new.confirmed_game_id is not distinct from old.confirmed_game_id
    and new.visibility is not distinct from old.visibility
    and new.invite_code is not distinct from old.invite_code
    and new.notes is not distinct from old.notes
    and new.status is not distinct from old.status
    and new.tournament_format is not distinct from old.tournament_format
    and new.best_of is not distinct from old.best_of
    and new.rounds_per_match is not distinct from old.rounds_per_match
    and new.require_payment is not distinct from old.require_payment
    and new.qualification_rule is not distinct from old.qualification_rule
    and new.custom_qualifiers is not distinct from old.custom_qualifiers
    and new.enable_third_place_match is not distinct from old.enable_third_place_match
    and new.first_prize is not distinct from old.first_prize
    and new.second_prize is not distinct from old.second_prize
    and new.third_prize is not distinct from old.third_prize
    and new.tournament_locked is not distinct from old.tournament_locked
    and new.seeded is not distinct from old.seeded
    and new.seed_label is not distinct from old.seed_label
    and new.seed_batch is not distinct from old.seed_batch
    and new.booking_type is not distinct from old.booking_type
    and new.ticket_type is not distinct from old.ticket_type
    and new.ticket_player_count is not distinct from old.ticket_player_count
    and new.ticket_total_price is not distinct from old.ticket_total_price
    and new.ticket_unit_price is not distinct from old.ticket_unit_price
    and new.ticket_status is not distinct from old.ticket_status
    and new.ticket_reference is not distinct from old.ticket_reference
    and new.ticket_customer_id is not distinct from old.ticket_customer_id
    and new.challenge_target_id is not distinct from old.challenge_target_id
    and new.challenge_status is not distinct from old.challenge_status
    and new.challenge_accepted_at is not distinct from old.challenge_accepted_at
    and new.challenge_declined_at is not distinct from old.challenge_declined_at
    and new.deleted_at is not distinct from old.deleted_at
    and new.deleted_by is not distinct from old.deleted_by
    and new.delete_reason is not distinct from old.delete_reason
  then
    return new;
  end if;

  raise exception 'Only session hosts and staff can edit this session.';
end;
$$;

create or replace function public.join_private_session_with_code(
  p_session_id uuid,
  p_invite_code text,
  p_display_name text,
  p_avatar_url text default null,
  p_avatar_emoji text default null,
  p_avatar_initials text default null,
  p_avatar_color text default null,
  p_avatar_text_color text default null,
  p_profile_motto text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_session public.sessions%rowtype;
  v_participant_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  select *
  into v_session
  from public.sessions s
  where s.id = p_session_id
    and s.deleted_at is null
    and s.status = 'open'
    and s.visibility = 'private'
    and s.booking_type is null
  limit 1;

  if v_session.id is null then
    raise exception 'Private session not found.';
  end if;

  if nullif(upper(btrim(coalesce(p_invite_code, ''))), '') is null
    or upper(btrim(coalesce(v_session.invite_code, ''))) <> upper(btrim(coalesce(p_invite_code, '')))
  then
    raise exception 'Incorrect private session code.';
  end if;

  if exists (
    select 1
    from public.session_participants sp
    where sp.session_id = p_session_id
      and sp.profile_id = v_actor
      and sp.deleted_at is null
  ) then
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.session_participants sp
  where sp.session_id = p_session_id
    and sp.deleted_at is null;

  if v_participant_count >= coalesce(v_session.max_players, 0) then
    raise exception 'Session is full.';
  end if;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto
  )
  values (
    p_session_id,
    v_actor,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_avatar_url, '')), ''),
    nullif(btrim(coalesce(p_avatar_emoji, '')), ''),
    nullif(btrim(coalesce(p_avatar_initials, '')), ''),
    nullif(btrim(coalesce(p_avatar_color, '')), ''),
    nullif(btrim(coalesce(p_avatar_text_color, '')), ''),
    nullif(btrim(coalesce(p_profile_motto, '')), '')
  );

  delete from public.session_waitlist
  where session_id = p_session_id
    and profile_id = v_actor;
end;
$$;

create or replace function public.join_private_session_waitlist_with_code(
  p_session_id uuid,
  p_invite_code text,
  p_display_name text,
  p_avatar_url text default null,
  p_avatar_emoji text default null,
  p_avatar_initials text default null,
  p_avatar_color text default null,
  p_avatar_text_color text default null,
  p_profile_motto text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_session public.sessions%rowtype;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  select *
  into v_session
  from public.sessions s
  where s.id = p_session_id
    and s.deleted_at is null
    and s.status = 'open'
    and s.visibility = 'private'
    and s.booking_type is null
  limit 1;

  if v_session.id is null then
    raise exception 'Private session not found.';
  end if;

  if nullif(upper(btrim(coalesce(p_invite_code, ''))), '') is null
    or upper(btrim(coalesce(v_session.invite_code, ''))) <> upper(btrim(coalesce(p_invite_code, '')))
  then
    raise exception 'Incorrect private session code.';
  end if;

  if exists (
    select 1
    from public.session_waitlist sw
    where sw.session_id = p_session_id
      and sw.profile_id = v_actor
  ) then
    return;
  end if;

  insert into public.session_waitlist (
    session_id,
    profile_id,
    display_name,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto
  )
  values (
    p_session_id,
    v_actor,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_avatar_url, '')), ''),
    nullif(btrim(coalesce(p_avatar_emoji, '')), ''),
    nullif(btrim(coalesce(p_avatar_initials, '')), ''),
    nullif(btrim(coalesce(p_avatar_color, '')), ''),
    nullif(btrim(coalesce(p_avatar_text_color, '')), ''),
    nullif(btrim(coalesce(p_profile_motto, '')), '')
  );
end;
$$;

drop trigger if exists sessions_protect_client_update on public.sessions;
create trigger sessions_protect_client_update
before update on public.sessions
for each row execute function public.protect_session_client_update();

alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_waitlist enable row level security;
alter table public.session_invites enable row level security;
alter table public.club_members enable row level security;

revoke all on public.sessions from anon;
revoke all on public.session_participants from anon;
revoke all on public.session_waitlist from anon;
revoke all on public.session_invites from anon;
revoke all on public.club_members from anon;

revoke all on public.sessions from public;
revoke all on public.session_participants from public;
revoke all on public.session_waitlist from public;
revoke all on public.session_invites from public;
revoke all on public.club_members from public;

revoke all on public.sessions from authenticated;
revoke all on public.session_participants from authenticated;
revoke all on public.session_waitlist from authenticated;
revoke all on public.session_invites from authenticated;
revoke all on public.club_members from authenticated;

grant select, insert, update on public.sessions to authenticated;
grant select, insert, update on public.session_participants to authenticated;
grant select, insert, update, delete on public.session_waitlist to authenticated;
grant select, insert, update, delete on public.session_invites to authenticated;
grant select, update, delete on public.club_members to authenticated;

grant all on public.sessions to service_role;
grant all on public.session_participants to service_role;
grant all on public.session_waitlist to service_role;
grant all on public.session_invites to service_role;
grant all on public.club_members to service_role;

drop policy if exists "sessions readable by allowed users" on public.sessions;
drop policy if exists "users create own sessions" on public.sessions;
drop policy if exists "session managers update sessions" on public.sessions;
drop policy if exists "participants update session votes" on public.sessions;

create policy "sessions readable by allowed users"
on public.sessions
for select
to authenticated
using (public.can_view_session_row(id));

create policy "users create own sessions"
on public.sessions
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and deleted_at is null
  and status in ('open', 'completed')
);

create policy "session managers update sessions"
on public.sessions
for update
to authenticated
using (public.can_manage_session_row(id))
with check (public.can_manage_session_row(id));

create policy "participants update session votes"
on public.sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.session_participants sp
    where sp.session_id = sessions.id
      and sp.profile_id = (select auth.uid())
      and sp.deleted_at is null
  )
)
with check (
  exists (
    select 1
    from public.session_participants sp
    where sp.session_id = sessions.id
      and sp.profile_id = (select auth.uid())
      and sp.deleted_at is null
  )
);

drop policy if exists "session participants readable by allowed users" on public.session_participants;
drop policy if exists "users join sessions as themselves" on public.session_participants;
drop policy if exists "session managers update participant results" on public.session_participants;
drop policy if exists "admins update participant results" on public.session_participants;

create policy "session participants readable by allowed users"
on public.session_participants
for select
to authenticated
using (deleted_at is null and public.can_view_session_row(session_id));

create policy "users join sessions as themselves"
on public.session_participants
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and deleted_at is null
  and exists (
    select 1
    from public.sessions s
    where s.id = session_participants.session_id
      and s.deleted_at is null
      and s.status = 'open'
      and (
        s.visibility = 'public'
        or s.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.session_invites si
          where si.session_id = s.id
            and si.recipient_id = (select auth.uid())
        )
      )
  )
);

create policy "session managers update participant results"
on public.session_participants
for update
to authenticated
using (deleted_at is null and public.can_manage_session_row(session_id))
with check (deleted_at is null and public.can_manage_session_row(session_id));

drop policy if exists "waitlist rows are readable" on public.session_waitlist;
drop policy if exists "waitlist readable by allowed users" on public.session_waitlist;
drop policy if exists "users can join their own waitlist" on public.session_waitlist;
drop policy if exists "users can leave their own waitlist" on public.session_waitlist;
drop policy if exists "session owners can manage waitlist" on public.session_waitlist;
drop policy if exists "admins can manage waitlist" on public.session_waitlist;

create policy "waitlist readable by allowed users"
on public.session_waitlist
for select
to authenticated
using (profile_id = (select auth.uid()) or public.can_manage_session_row(session_id));

create policy "users can join their own waitlist"
on public.session_waitlist
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.sessions s
    where s.id = session_waitlist.session_id
      and s.deleted_at is null
      and s.status = 'open'
      and (
        s.visibility = 'public'
        or s.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.session_invites si
          where si.session_id = s.id
            and si.recipient_id = (select auth.uid())
        )
      )
  )
);

create policy "users can leave their own waitlist"
on public.session_waitlist
for delete
to authenticated
using (profile_id = (select auth.uid()) or public.can_manage_session_row(session_id));

drop policy if exists "session invites are readable" on public.session_invites;
drop policy if exists "session invites readable by related users" on public.session_invites;
drop policy if exists "users create own invites" on public.session_invites;
drop policy if exists "invited users update their invites" on public.session_invites;
drop policy if exists "invite owners can delete invites" on public.session_invites;

create policy "session invites readable by related users"
on public.session_invites
for select
to authenticated
using (
  inviter_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or public.can_manage_session_row(session_id)
);

create policy "users create own invites"
on public.session_invites
for insert
to authenticated
with check (
  inviter_id = (select auth.uid())
  and (
    public.can_manage_session_row(session_id)
    or exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_invites.session_id
        and sp.profile_id = (select auth.uid())
        and sp.deleted_at is null
    )
  )
);

create policy "invited users update their invites"
on public.session_invites
for update
to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy "invite owners can delete invites"
on public.session_invites
for delete
to authenticated
using (
  inviter_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or public.can_manage_session_row(session_id)
);

drop policy if exists "club members view private content by role" on public.club_members;
drop policy if exists "club members readable by allowed users" on public.club_members;

create policy "club members readable by allowed users"
on public.club_members
for select
to authenticated
using (
  public.is_vrena_admin()
  or profile_id = (select auth.uid())
  or exists (
    select 1
    from public.clubs c
    where c.id = club_members.club_id
      and (c.visibility = 'public' or c.owner_id = (select auth.uid()))
  )
  or exists (
    select 1
    from public.club_members actor_membership
    where actor_membership.club_id = club_members.club_id
      and actor_membership.profile_id = (select auth.uid())
      and actor_membership.status = 'approved'
      and actor_membership.deleted_at is null
  )
);

create or replace function public.sessions_list_page(
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 120,
  p_offset integer default 0,
  p_include_blocked_times boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sessions jsonb := '[]'::jsonb;
  v_score_adjustments jsonb := '{}'::jsonb;
  v_blocked_times jsonb := '[]'::jsonb;
  v_has_more_after boolean := false;
begin
  with selected_sessions as (
    select s.*
    from public.sessions s
    where s.deleted_at is null
      and s.status <> 'cancelled'
      and (p_start_date is null or s.date >= p_start_date)
      and (p_end_date is null or s.date <= p_end_date)
      and (
        s.visibility = 'public'
        or (s.visibility = 'private' and s.booking_type is null)
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
        'booking_type', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end,
        'ticket_type', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end,
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
        and s.status <> 'cancelled'
        and s.date > p_end_date
    )
    into v_has_more_after;
  end if;

  if p_include_blocked_times and v_actor_rank >= 50 then
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
$$;

create or replace function public.session_detail(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_payload jsonb;
begin
  with selected_session as (
    select s.*
    from public.sessions s
    where s.id = p_session_id
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and (
        s.visibility = 'public'
        or (s.visibility = 'private' and s.booking_type is null)
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
    limit 1
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
          'checked_in', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.checked_in else null end,
          'payment_status', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.payment_status else null end,
          'payment_amount', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.payment_amount else null end,
          'payment_splits', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.payment_splits else null end,
          'score', sp.score,
          'accuracy_percent', sp.accuracy_percent,
          'projectiles_fired', sp.projectiles_fired,
          'escape_duration_seconds', sp.escape_duration_seconds,
          'placement', sp.placement,
          'prize_claimed', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.prize_claimed else null end,
          'prize_claimed_at', case when v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor then sp.prize_claimed_at else null end
        )
        order by sp.id
      ) as session_participants
    from public.session_participants sp
    join selected_session s on s.id = sp.session_id
    where sp.deleted_at is null
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
          'display_name', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.display_name else null end,
          'avatar_url', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_url else null end,
          'avatar_emoji', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_emoji else null end,
          'avatar_initials', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_initials else null end,
          'avatar_color', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_color else null end,
          'avatar_text_color', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.avatar_text_color else null end,
          'profile_motto', case when v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor then sw.profile_motto else null end,
          'created_at', sw.created_at
        )
        order by sw.created_at asc, sw.id
      ) as session_waitlist
    from public.session_waitlist sw
    join selected_session s on s.id = sw.session_id
    where v_actor_rank >= 50 or sw.profile_id = v_actor or s.owner_id = v_actor
    group by sw.session_id
  ),
  invite_rows as (
    select
      si.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'session_id', si.session_id,
          'inviter_id', si.inviter_id,
          'recipient_id', si.recipient_id,
          'recipient_display_name', si.recipient_display_name,
          'recipient_avatar_url', si.recipient_avatar_url,
          'recipient_avatar_emoji', si.recipient_avatar_emoji,
          'recipient_avatar_initials', si.recipient_avatar_initials,
          'recipient_avatar_color', si.recipient_avatar_color,
          'recipient_avatar_text_color', si.recipient_avatar_text_color,
          'recipient_profile_motto', si.recipient_profile_motto,
          'status', si.status,
          'created_at', si.created_at
        )
        order by si.created_at desc, si.id
      ) as session_invites
    from public.session_invites si
    join selected_session s on s.id = si.session_id
    where v_actor is not null
      and (v_actor_rank >= 50 or s.owner_id = v_actor or si.inviter_id = v_actor or si.recipient_id = v_actor)
    group by si.session_id
  ),
  participant_profile_ids as (
    select distinct sp.profile_id
    from public.session_participants sp
    join selected_session s on s.id = sp.session_id
    where sp.deleted_at is null
      and (v_actor_rank >= 50 or sp.profile_id = v_actor or s.owner_id = v_actor)
  )
  select jsonb_build_object(
    'session',
    jsonb_build_object(
      'id', s.id,
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
      'notes', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.notes else null end,
      'status', s.status,
      'tournament_format', s.tournament_format,
      'best_of', s.best_of,
      'rounds_per_match', s.rounds_per_match,
      'require_payment', s.require_payment,
      'qualification_rule', s.qualification_rule,
      'custom_qualifiers', s.custom_qualifiers,
      'enable_third_place_match', s.enable_third_place_match,
      'first_prize', s.first_prize,
      'second_prize', s.second_prize,
      'third_prize', s.third_prize,
      'tournament_locked', s.tournament_locked,
      'seeded', s.seeded,
      'seed_label', s.seed_label,
      'seed_batch', case when v_actor_rank >= 50 then s.seed_batch else null end,
      'booking_type', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end,
      'ticket_type', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end,
      'ticket_player_count', s.ticket_player_count,
      'ticket_total_price', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_total_price else null end,
      'ticket_unit_price', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_unit_price else null end,
      'ticket_status', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_status else null end,
      'ticket_reference', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_reference else null end,
      'ticket_customer_id', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_customer_id else null end,
      'challenge_target_id', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_target_id else null end,
      'challenge_status', s.challenge_status,
      'challenge_accepted_at', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_accepted_at else null end,
      'challenge_declined_at', case when v_actor_rank >= 50 or s.owner_id = v_actor or s.challenge_target_id = v_actor then s.challenge_declined_at else null end,
      'session_participants', coalesce(pr.session_participants, '[]'::jsonb),
      'session_waitlist', coalesce(wr.session_waitlist, '[]'::jsonb)
    ),
    'invites',
    coalesce(ir.session_invites, '[]'::jsonb),
    'scoreAdjustments',
    coalesce((
      select jsonb_object_agg(p.id::text, coalesce(p.score_adjustment, 0))
      from public.profiles p
      join participant_profile_ids ids on ids.profile_id = p.id
      where p.deleted_at is null
    ), '{}'::jsonb)
  )
  into v_payload
  from selected_session s
  left join participant_rows pr on pr.session_id = s.id
  left join waitlist_rows wr on wr.session_id = s.id
  left join invite_rows ir on ir.session_id = s.id;

  return coalesce(v_payload, jsonb_build_object(
    'session', null,
    'invites', '[]'::jsonb,
    'scoreAdjustments', '{}'::jsonb
  ));
end;
$$;

revoke all on function public.can_manage_session_row(uuid) from public, anon, authenticated;
revoke all on function public.can_view_session_row(uuid) from public, anon, authenticated;
revoke all on function public.protect_session_client_update() from public, anon, authenticated;
revoke all on function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.sessions_list_page(date, date, integer, integer, boolean) from public;
revoke all on function public.session_detail(uuid) from public;
grant execute on function public.sessions_list_page(date, date, integer, integer, boolean) to anon, authenticated, service_role;
grant execute on function public.session_detail(uuid) to anon, authenticated, service_role;
grant execute on function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
