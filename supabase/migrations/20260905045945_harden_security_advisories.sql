begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The kiosk rollout replaced the named-account MFA check. Restore it at the
-- shared database boundary, while retaining the separately verified kiosk PIN.
create or replace function public.current_staff_role_rank()
returns integer language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_profile_role text;
begin
  if v_actor is null or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    return 0;
  end if;

  select lower(users.email), profiles.role into v_email, v_profile_role
  from auth.users as users
  join public.profiles as profiles on profiles.id = users.id and profiles.deleted_at is null
  where users.id = v_actor and users.deleted_at is null and not coalesce(users.is_anonymous, false);
  if not found then return 0; end if;

  if v_email = 'contact@vre-vietnam.com' then
    return private.current_staff_kiosk_role_rank();
  end if;

  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2'
    or not exists (select 1 from auth.mfa_factors where user_id = v_actor and status = 'verified') then
    return 0;
  end if;

  -- Authorization uses current account state, never a stale JWT email fallback.
  return greatest(public.staff_role_rank(v_profile_role, null), public.staff_role_rank(null, v_email));
end;
$$;

create or replace function public.current_staff_role_key()
returns text language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_rank integer := public.current_staff_role_rank();
  v_email text;
  v_profile_role text;
begin
  if v_actor is null or v_rank < 20 then return 'player'; end if;
  select lower(users.email), profiles.role into v_email, v_profile_role
  from auth.users as users
  join public.profiles as profiles on profiles.id = users.id and profiles.deleted_at is null
  where users.id = v_actor;
  if v_email = 'contact@vre-vietnam.com' then
    return coalesce(private.current_staff_kiosk_role_key(), 'player');
  end if;
  if v_rank >= 120 then return 'owner'; end if;
  if v_rank >= 100 then return 'admin'; end if;
  if lower(coalesce(v_profile_role, '')) = 'cashier' then return 'cashier'; end if;
  return 'viewer';
end;
$$;

-- Keep the current kiosk-aware attendance behavior behind private RLS helpers.
create or replace function private.can_read_staff_attendance_row(p_profile_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
    or p_profile_id = public.current_staff_actor_profile_id()
$$;
create or replace function private.is_staff_attendance_editor()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$ select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier') $$;

create or replace function public.can_read_staff_attendance_row(p_profile_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.can_read_staff_attendance_row(p_profile_id) $$;
create or replace function public.is_staff_attendance_editor()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$ select private.is_staff_attendance_editor() $$;

revoke all on function public.current_staff_role_key() from public, anon, authenticated;
grant execute on function public.current_staff_role_key() to service_role;
revoke all on function public.can_read_staff_attendance_row(uuid), public.is_staff_attendance_editor() from public, anon, authenticated;
grant execute on function public.can_read_staff_attendance_row(uuid), public.is_staff_attendance_editor() to service_role;
revoke all on function public.current_staff_role_rank() from public, anon;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;

-- No browser feature needs TRUNCATE, trigger/foreign-key DDL, or maintenance.
-- Public booking writes use explicitly granted, validating RPCs.
do $$
declare t record;
begin
  for t in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind = 'r'
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger, maintain on table %I.%I from anon', t.nspname, t.relname);
    execute format('revoke truncate, references, trigger, maintain on table %I.%I from authenticated', t.nspname, t.relname);
  end loop;
end;
$$;
revoke insert, update, delete on public.tournament_audit_log from authenticated;

-- Explicit deny documents intentionally service-only tables without opening RLS.
revoke all on public.app_analytics_events, public.venue_game_result_duplicate_archive from anon, authenticated;
drop policy if exists "analytics deny browser access" on public.app_analytics_events;
create policy "analytics deny browser access" on public.app_analytics_events
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "result archive deny browser access" on public.venue_game_result_duplicate_archive;
create policy "result archive deny browser access" on public.venue_game_result_duplicate_archive
  for all to anon, authenticated using (false) with check (false);

-- These clients already require a signed-in player. Approved messages and
-- tournament metadata must also respect the parent session's visibility.
revoke select on public.session_messages from anon;
alter policy "session messages are readable" on public.session_messages to authenticated
using (
  (moderation_status = 'approved' and private.can_view_session_row(session_id))
  or author_id = (select auth.uid())
  or exists (select 1 from public.sessions where sessions.id = session_messages.session_id and sessions.owner_id = (select auth.uid()))
);
alter policy "authors delete own messages" on public.session_messages to authenticated;
drop policy if exists "Tournament editors visible" on public.tournament_editors;
alter policy "Tournament editors are readable" on public.tournament_editors
using (private.can_view_session_row(session_id));
alter policy "Tournament matches are readable" on public.tournament_matches
using (private.can_view_session_row(session_id));
alter policy "Tournament teams are readable" on public.tournament_teams
using (private.can_view_session_row(session_id));
alter policy "Tournament team members are readable" on public.tournament_team_members
using (exists (select 1 from public.tournament_teams team where team.id = tournament_team_members.team_id and private.can_view_session_row(team.session_id)));
alter policy "Tournament data is readable" on public.tournament_pools
using (private.can_view_session_row(session_id));
alter policy "Tournament entries are readable" on public.tournament_pool_entries
using (private.can_view_session_row(session_id));

-- Legacy policy admin checks must use the same MFA-protected staff boundary.
alter policy "Admins create blocked times" on public."blocked_times"
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100)))));
alter policy "Admins delete blocked times" on public."blocked_times"
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100)))));
alter policy "Admins update blocked times" on public."blocked_times"
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100)))));
alter policy "Admins manage pricing rules" on public."pricing_rules"
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100)))));
alter policy "Club creators delete clubs" on public."clubs"
using (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100))))));
alter policy "Club creators update clubs" on public."clubs"
using (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100))))));
alter policy "Users or club creators remove club members" on public."club_members"
using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM clubs c
  WHERE ((c.id = club_members.club_id) AND ((c.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND ((select public.current_staff_role_rank()) >= 100))))))))));

-- An ordinary join may not assign the joining user an admin or owner role.
drop policy if exists "Users join or request clubs" on public.club_members;
drop policy if exists "Club creators approve members" on public.club_members;
alter policy "users insert own club membership rows" on public.club_members
with check (
  deleted_at is null and private.can_insert_club_member_row(club_id, profile_id, status)
  and (role = 'member' or (role = 'owner' and exists (
    select 1 from public.clubs where clubs.id = club_members.club_id and clubs.owner_id = (select auth.uid())
  )))
);

-- Compatibility wrappers only delegate to separately authorized RPCs and do
-- not need to run with the function owner's privileges themselves.
alter function public.get_leaderboard_players() security invoker;
alter function public.staff_report_summary(date,date,date,date,integer) security invoker;
alter function public.staff_save_player_achievement_profile(uuid,integer,jsonb,jsonb,jsonb,text) security invoker;

commit;
