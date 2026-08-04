begin;

-- Employee HR identities never become assignable web-app accounts. Their
-- operational Manager/Staff permission remains exclusively on the PIN.
create or replace function public.set_staff_profile_role(
  p_profile_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_saved_role text;
begin
  if v_actor is null or v_actor_rank < 100 then
    raise exception 'Admin access required.';
  end if;

  if to_regprocedure('public.consume_rate_limit(text, integer, integer, text)') is not null then
    perform public.consume_rate_limit('admin_destructive', 3, 60, 'role:' || p_profile_id::text);
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if v_new_role = 'super_admin' then
    v_new_role := 'owner';
  end if;

  if v_new_role not in ('owner', 'admin', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid web-app role.';
  end if;

  select role
  into v_old_role
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if lower(coalesce(v_old_role, '')) = 'employee' then
    raise exception 'Employee HR identities use PIN permissions and do not have an assignable web-app role.';
  end if;

  if (v_new_role = 'owner' or lower(coalesce(v_old_role, '')) in ('super_admin', 'owner'))
    and v_actor_rank < 120
  then
    raise exception 'Owner access required.';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning role into v_saved_role;

  if v_saved_role is distinct from v_new_role then
    raise exception 'Role update failed.';
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'role_updated',
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', v_saved_role)
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'old_role', v_old_role,
    'role', v_saved_role
  );
end;
$$;

-- Keep HR-only identities permanently non-login and non-privileged, even when
-- other profile columns are updated later through the service-role HR API.
drop trigger if exists profiles_hr_only_identity_guard on public.profiles;
create trigger profiles_hr_only_identity_guard
before insert or update on public.profiles
for each row execute function private.guard_hr_only_profile_identity();

revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
