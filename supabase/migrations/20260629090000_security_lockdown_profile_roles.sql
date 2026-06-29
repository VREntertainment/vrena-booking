begin;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_role text := lower(nullif(btrim(coalesce(new.role, 'player')), ''));
  v_old_role text := case
    when tg_op = 'UPDATE' then lower(nullif(btrim(coalesce(old.role, 'player')), ''))
    else null
  end;
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if v_new_role is null then
    v_new_role := 'player';
  end if;

  if v_new_role = 'super_admin' then
    v_new_role := 'owner';
  end if;

  if v_old_role = 'super_admin' then
    v_old_role := 'owner';
  end if;

  if v_new_role not in ('owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid profile role.';
  end if;

  if tg_op = 'INSERT' then
    if v_new_role <> 'player' and not v_is_service_role and v_actor_rank < 100 then
      new.role := 'player';
    else
      new.role := v_new_role;
    end if;
    return new;
  end if;

  if v_new_role is distinct from v_old_role
    and not v_is_service_role
    and v_actor_rank < 100
  then
    raise exception 'Admin access required to change profile roles.';
  end if;

  new.role := v_new_role;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before insert or update of role on public.profiles
for each row execute function public.protect_profile_role();

revoke update (role) on public.profiles from authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
