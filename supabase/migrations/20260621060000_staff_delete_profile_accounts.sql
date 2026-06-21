create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid,
  add column if not exists ban_reason text;

create index if not exists profiles_banned_at_idx
on public.profiles (banned_at)
where banned_at is not null;

create or replace function public.consume_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_reset_at timestamptz;
  v_headers jsonb := '{}'::jsonb;
  v_ip text := 'unknown';
  v_actor text := coalesce((select auth.uid())::text, '');
  v_subject text;
  v_hash_material text;
  v_hash text;
  v_count integer;
begin
  if p_action not in ('login_attempt', 'otp_request', 'join_leave', 'booking_attempt', 'admin_destructive') then
    raise exception 'Unknown rate limit action.';
  end if;

  if coalesce(p_limit, 0) < 1 or coalesce(p_window_seconds, 0) < 1 then
    raise exception 'Invalid rate limit configuration.';
  end if;

  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := split_part(coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'x-real-ip',
    'unknown'
  ), ',', 1);
  v_subject := lower(coalesce(nullif(btrim(p_subject), ''), v_actor, 'anonymous'));
  v_hash_material := lower(p_action) || ':' || v_actor || ':' || v_subject || ':' || v_ip;

  if to_regprocedure('extensions.digest(text, text)') is not null then
    execute 'select encode(extensions.digest($1, $2), ''hex'')'
    into v_hash
    using v_hash_material, 'sha256';
  elsif to_regprocedure('public.digest(text, text)') is not null then
    execute 'select encode(public.digest($1, $2), ''hex'')'
    into v_hash
    using v_hash_material, 'sha256';
  else
    v_hash := md5(v_hash_material);
  end if;

  v_window_started_at := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_window_started_at + make_interval(secs => p_window_seconds);

  delete from public.security_rate_limits
  where reset_at < v_now - interval '1 day';

  insert into public.security_rate_limits (
    subject_hash,
    action,
    window_started_at,
    reset_at,
    attempt_count,
    last_seen_at
  )
  values (
    v_hash,
    p_action,
    v_window_started_at,
    v_reset_at,
    1,
    v_now
  )
  on conflict (subject_hash, action, window_started_at)
  do update
  set attempt_count = public.security_rate_limits.attempt_count + 1,
      last_seen_at = excluded.last_seen_at,
      reset_at = excluded.reset_at
  returning attempt_count into v_count;

  if v_count > p_limit then
    raise exception 'Too many attempts. Please wait a moment and try again.';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_reset_at
  );
end;
$$;

create or replace function public.staff_delete_profile_account(
  p_profile_id uuid,
  p_delete_reason text default null,
  p_ban boolean default false,
  p_ban_reason text default null
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

  perform public.consume_rate_limit('admin_destructive', 3, 60, 'profile-account:' || p_profile_id::text);

  select role, email
  into v_target_role, v_target_email
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
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
      banned_at = case when coalesce(p_ban, false) then coalesce(banned_at, now()) else banned_at end,
      banned_by = case when coalesce(p_ban, false) then v_actor else banned_by end,
      ban_reason = case when coalesce(p_ban, false) then coalesce(v_ban_reason, v_delete_reason, 'Staff Console ban') else ban_reason end,
      role = case when coalesce(p_ban, false) and v_target_rank < 120 then 'player' else role end,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null;

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

revoke all on function public.consume_rate_limit(text, integer, integer, text) from public;
revoke all on function public.staff_delete_profile_account(uuid, text, boolean, text) from public, anon;

grant execute on function public.consume_rate_limit(text, integer, integer, text) to anon, authenticated, service_role;
grant execute on function public.staff_delete_profile_account(uuid, text, boolean, text) to authenticated, service_role;

notify pgrst, 'reload schema';
