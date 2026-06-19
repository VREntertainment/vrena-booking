create or replace function public.set_staff_profile_role(
  p_profile_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
begin
  if v_actor is null or not public.is_vrena_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if v_new_role not in ('owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid staff role.';
  end if;

  select role
  into v_old_role
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set role = v_new_role
  where id = p_profile_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    'role_updated',
    'profile',
    p_profile_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_new_role)
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'old_role', v_old_role,
    'role', v_new_role
  );
end;
$$;

revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;
