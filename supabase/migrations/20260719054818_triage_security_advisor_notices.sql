-- Resolve actionable Supabase security-advisor notices without removing the
-- deliberately public booking, session, club-list, and leaderboard RPCs.

-- These helpers are used by authenticated-only RLS policies. Keeping anon
-- EXECUTE made them directly reachable through PostgREST even though an
-- anonymous call could not pass their authorization predicates.
alter policy "club member roles managed by authorized roles"
  on public.club_members
  to authenticated;

alter policy "club members removed by authorized roles"
  on public.club_members
  to authenticated;

alter policy "club members create club messages"
  on public.club_messages
  to authenticated;

alter policy "club messages are readable by club members"
  on public.club_messages
  to authenticated;

alter policy "club messages soft deleted by authors or admins"
  on public.club_messages
  to authenticated;

alter policy "club settings editable by authorized club roles"
  on public.clubs
  to authenticated;

alter policy "admins read marketing list"
  on public.marketing_list
  to authenticated;

revoke execute on function public.can_manage_club_member(uuid, uuid, text)
  from public, anon;
revoke execute on function public.can_manage_club_settings(uuid)
  from public, anon;
revoke execute on function public.can_use_club_messages(uuid)
  from public, anon;
revoke execute on function public.is_vrena_admin()
  from public, anon;

grant execute on function public.can_manage_club_member(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.can_manage_club_settings(uuid)
  to authenticated, service_role;
grant execute on function public.can_use_club_messages(uuid)
  to authenticated, service_role;
grant execute on function public.is_vrena_admin()
  to authenticated, service_role;

-- These tables are written only by trusted server clients or privileged
-- database functions. Explicit deny policies document that boundary and keep
-- it fail-closed if a browser-role table grant is added later.
revoke all on table private.integration_settings
  from public, anon, authenticated;
revoke all on table public.bookings
  from public, anon, authenticated;
revoke all on table public.message_translations
  from public, anon, authenticated;
revoke all on table public.security_rate_limits
  from public, anon, authenticated;
revoke all on table public.staff_zalo_attendance_events
  from public, anon, authenticated;
revoke all on table public.staff_zalo_identities
  from public, anon, authenticated;

create policy "integration settings deny browser access"
on private.integration_settings
for all
to anon, authenticated
using (false)
with check (false);

create policy "bookings deny browser access"
on public.bookings
for all
to anon, authenticated
using (false)
with check (false);

create policy "message translations deny browser access"
on public.message_translations
for all
to anon, authenticated
using (false)
with check (false);

create policy "security rate limits deny browser access"
on public.security_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

create policy "staff Zalo attendance events deny browser access"
on public.staff_zalo_attendance_events
for all
to anon, authenticated
using (false)
with check (false);

create policy "staff Zalo identities deny browser access"
on public.staff_zalo_identities
for all
to anon, authenticated
using (false)
with check (false);

-- Every name referenced by these functions is either a pg_catalog builtin or,
-- for the order-number trigger, an explicitly schema-qualified sequence.
alter function public.staff_set_updated_at()
  set search_path = pg_catalog;
alter function public.staff_set_order_number()
  set search_path = pg_catalog;
alter function public.push_session_body(text, date, time without time zone)
  set search_path = pg_catalog;
alter function public.staff_role_rank(text, text)
  set search_path = pg_catalog;
alter function public.profile_achievement_awards_touch_updated_at()
  set search_path = pg_catalog;
alter function public.profile_achievement_unlock_views_touch_updated_at()
  set search_path = pg_catalog;
