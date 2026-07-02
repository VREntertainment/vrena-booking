alter table public.profiles
  add column if not exists average_accuracy_override double precision,
  add column if not exists best_escape_duration_seconds_override integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_average_accuracy_override_check'
  ) then
    alter table public.profiles
      add constraint profiles_average_accuracy_override_check
      check (average_accuracy_override is null or (average_accuracy_override >= 0 and average_accuracy_override <= 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_best_escape_duration_seconds_override_check'
  ) then
    alter table public.profiles
      add constraint profiles_best_escape_duration_seconds_override_check
      check (best_escape_duration_seconds_override is null or best_escape_duration_seconds_override > 0);
  end if;
end $$;

create or replace function public.set_profile_stat_overrides(
  p_profile_id uuid,
  p_average_accuracy double precision default null,
  p_best_escape_duration_seconds integer default null,
  p_update_average_accuracy boolean default false,
  p_update_best_escape_duration boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_average_accuracy double precision;
  v_old_best_escape_duration_seconds integer;
  v_saved_average_accuracy double precision;
  v_saved_best_escape_duration_seconds integer;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_update_average_accuracy and p_average_accuracy is not null and (p_average_accuracy < 0 or p_average_accuracy > 100) then
    raise exception 'Accuracy must be between 0 and 100.';
  end if;

  if p_update_best_escape_duration and p_best_escape_duration_seconds is not null and p_best_escape_duration_seconds <= 0 then
    raise exception 'Best escape time must be greater than 0.';
  end if;

  select average_accuracy_override, best_escape_duration_seconds_override
  into v_old_average_accuracy, v_old_best_escape_duration_seconds
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.profiles
  set average_accuracy_override = case when p_update_average_accuracy then p_average_accuracy else average_accuracy_override end,
      best_escape_duration_seconds_override = case when p_update_best_escape_duration then p_best_escape_duration_seconds else best_escape_duration_seconds_override end,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning average_accuracy_override, best_escape_duration_seconds_override
  into v_saved_average_accuracy, v_saved_best_escape_duration_seconds;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'profile_stat_overrides_updated',
      'profile',
      p_profile_id,
      jsonb_build_object(
        'average_accuracy_override', v_old_average_accuracy,
        'best_escape_duration_seconds_override', v_old_best_escape_duration_seconds
      ),
      jsonb_build_object(
        'average_accuracy_override', v_saved_average_accuracy,
        'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds
      )
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'average_accuracy_override', v_saved_average_accuracy,
    'best_escape_duration_seconds_override', v_saved_best_escape_duration_seconds
  );
end;
$$;

revoke all on function public.set_profile_stat_overrides(uuid, double precision, integer, boolean, boolean) from public, anon;
grant execute on function public.set_profile_stat_overrides(uuid, double precision, integer, boolean, boolean) to authenticated, service_role;

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
      new.average_accuracy_override := null;
      new.best_escape_duration_seconds_override := null;
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
    or new.average_accuracy_override is distinct from old.average_accuracy_override
    or new.best_escape_duration_seconds_override is distinct from old.best_escape_duration_seconds_override
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
