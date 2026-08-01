begin;

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
  if p_action not in (
    'login_attempt',
    'otp_request',
    'join_leave',
    'booking_attempt',
    'admin_destructive',
    'password_reset',
    'password_reset_ip',
    'invite_player',
    'session_message',
    'customer_invite',
    'customer_invite_actor',
    'voucher_quote',
    'staff_config_write'
  ) then
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

revoke all on function public.consume_rate_limit(text, integer, integer, text) from public;
grant execute on function public.consume_rate_limit(text, integer, integer, text) to anon, authenticated, service_role;

commit;
