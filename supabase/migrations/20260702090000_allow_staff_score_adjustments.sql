create or replace function public.set_profile_score_adjustment(
  p_profile_id uuid,
  p_score_adjustment integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_score integer;
  v_saved_score integer;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_score_adjustment is null then
    raise exception 'Score adjustment is required.';
  end if;

  select score_adjustment
  into v_old_score
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set score_adjustment = p_score_adjustment,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning score_adjustment into v_saved_score;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'score_adjustment_updated',
      'profile',
      p_profile_id,
      jsonb_build_object('score_adjustment', v_old_score),
      jsonb_build_object('score_adjustment', v_saved_score)
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'score_adjustment', v_saved_score
  );
end;
$$;

revoke all on function public.set_profile_score_adjustment(uuid, integer) from public, anon;
grant execute on function public.set_profile_score_adjustment(uuid, integer) to authenticated, service_role;

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_auth_email text := nullif(lower(auth.jwt() ->> 'email'), '');
begin
  if v_is_service_role then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_actor_rank < 100 then
      new.role := 'player';
      new.email := coalesce(v_auth_email, lower(nullif(new.email, '')));
      new.score_adjustment := 0;
      new.loyalty_points_total := 0;
      new.deleted_at := null;
      new.deleted_by := null;
      new.delete_reason := null;
      new.banned_at := null;
      new.banned_by := null;
      new.ban_reason := null;
      new.is_seed_demo := false;
      new.seed_batch := null;
    end if;

    return new;
  end if;

  if v_actor_rank < 50 and (
    new.score_adjustment is distinct from old.score_adjustment
    or new.loyalty_points_total is distinct from old.loyalty_points_total
  ) then
    raise exception 'Staff access required to change profile stats.';
  end if;

  if v_actor_rank < 100 and (
    new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.delete_reason is distinct from old.delete_reason
    or new.banned_at is distinct from old.banned_at
    or new.banned_by is distinct from old.banned_by
    or new.ban_reason is distinct from old.ban_reason
    or new.is_seed_demo is distinct from old.is_seed_demo
    or new.seed_batch is distinct from old.seed_batch
  ) then
    raise exception 'Admin access required to change protected profile fields.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_sensitive_fields() from public, anon, authenticated;
