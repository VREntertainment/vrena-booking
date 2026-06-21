alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid,
  add column if not exists ban_reason text;

create index if not exists profiles_banned_at_idx
on public.profiles (banned_at)
where banned_at is not null;

drop function if exists public.staff_delete_profile_account(uuid, text, boolean, text);
drop function if exists public.staff_delete_profile_account(uuid, text, boolean, text, text);

create or replace function public.staff_delete_profile_account(
  p_profile_id uuid,
  p_delete_reason text default null,
  p_ban boolean default false,
  p_ban_reason text default null,
  p_confirmation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_delete_reason text := nullif(btrim(coalesce(p_delete_reason, '')), '');
  v_ban_reason text := nullif(btrim(coalesce(p_ban_reason, p_delete_reason, '')), '');
  v_target_role text;
  v_target_email text;
  v_target_rank integer;
  v_count integer := 0;
begin
  if v_actor is null or v_actor_rank < 100 then
    raise exception 'Admin access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_profile_id = v_actor then
    raise exception 'You cannot delete your own Staff Console account.';
  end if;

  if coalesce(p_confirmation, '') <> 'DELETE' then
    raise exception 'Type DELETE to confirm account deletion.';
  end if;

  perform public.consume_rate_limit('admin_destructive', 3, 60, 'profile-account:' || p_profile_id::text);

  select profiles.role, profiles.email
  into v_target_role, v_target_email
  from public.profiles
  where profiles.id = p_profile_id
    and profiles.deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  v_target_rank := public.staff_role_rank(v_target_role, v_target_email);

  if v_target_rank >= 120 and v_actor_rank < 120 then
    raise exception 'Owner access required.';
  end if;

  update public.profiles
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = coalesce(v_delete_reason, 'Staff Console account deletion'),
      banned_at = case when coalesce(p_ban, false) then coalesce(profiles.banned_at, now()) else profiles.banned_at end,
      banned_by = case when coalesce(p_ban, false) then v_actor else profiles.banned_by end,
      ban_reason = case when coalesce(p_ban, false) then coalesce(v_ban_reason, v_delete_reason, 'Staff Console ban') else profiles.ban_reason end,
      role = case when coalesce(p_ban, false) and v_target_rank < 120 then 'player' else profiles.role end,
      updated_at = now()
  where profiles.id = p_profile_id
    and profiles.deleted_at is null;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'No active profile found to delete.';
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      case when coalesce(p_ban, false) then 'profile_account_deleted_and_banned' else 'profile_account_deleted' end,
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_target_role, 'email', v_target_email),
      jsonb_build_object(
        'deleted', true,
        'banned', coalesce(p_ban, false),
        'delete_reason', coalesce(v_delete_reason, 'Staff Console account deletion'),
        'ban_reason', case when coalesce(p_ban, false) then coalesce(v_ban_reason, v_delete_reason, 'Staff Console ban') else null end
      )
    );
  end if;

  return jsonb_build_object(
    'deleted', true,
    'banned', coalesce(p_ban, false),
    'profile_id', p_profile_id
  );
end;
$$;

revoke all on function public.staff_delete_profile_account(uuid, text, boolean, text, text) from public, anon;
grant execute on function public.staff_delete_profile_account(uuid, text, boolean, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
