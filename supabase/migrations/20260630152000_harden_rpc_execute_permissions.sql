begin;

create or replace function public.club_member_role(p_club_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_is_internal boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_is_admin boolean := public.is_vrena_admin();
  v_role text := '';
begin
  if p_club_id is null or p_profile_id is null then
    return '';
  end if;

  if not v_actor_is_internal
    and not v_actor_is_admin
    and (v_actor is null or v_actor <> p_profile_id)
  then
    return '';
  end if;

  select case
    when exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = p_profile_id
    ) then 'owner'
    else coalesce((
      select club_members.role
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = p_profile_id
        and club_members.status = 'approved'
        and club_members.deleted_at is null
      limit 1
    ), '')
  end
  into v_role;

  return coalesce(v_role, '');
end;
$$;

revoke all on function public.club_member_role(uuid, uuid) from public, anon;
grant execute on function public.club_member_role(uuid, uuid) to authenticated, service_role;

revoke all on function public.enqueue_push_event(uuid, text, text, uuid, text, text, text, jsonb, timestamptz)
from public, anon, authenticated;
grant execute on function public.enqueue_push_event(uuid, text, text, uuid, text, text, text, jsonb, timestamptz)
to service_role;

revoke all on function public.enqueue_session_invite_push() from public, anon, authenticated;
revoke all on function public.enqueue_session_change_push() from public, anon, authenticated;
revoke all on function public.enqueue_club_session_push() from public, anon, authenticated;
revoke all on function public.enqueue_waitlist_promotion_push() from public, anon, authenticated;
revoke all on function public.enqueue_club_admin_message_push() from public, anon, authenticated;

revoke all on function public.staff_audit_trigger() from public, anon, authenticated;
revoke all on function public.staff_loyalty_audit_trigger() from public, anon, authenticated;
revoke all on function public.staff_attendance_touch_updated_at() from public, anon, authenticated;
revoke all on function public.sync_challenge_invite_status() from public, anon, authenticated;

revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.protect_profile_sensitive_fields() from public, anon, authenticated;
revoke all on function public.protect_profile_loyalty_points_total() from public, anon, authenticated;
revoke all on function public.protect_session_client_update() from public, anon, authenticated;
revoke all on function public.protect_session_participant_trusted_fields() from public, anon, authenticated;
revoke all on function public.rate_limit_session_invites() from public, anon, authenticated;
revoke all on function public.rate_limit_session_creates() from public, anon, authenticated;
revoke all on function public.rate_limit_staff_config_write() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
