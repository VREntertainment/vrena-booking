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
    'invite_player',
    'session_message',
    'customer_invite',
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

revoke all on function public.consume_rate_limit(text, integer, integer, text) from public;
grant execute on function public.consume_rate_limit(text, integer, integer, text) to anon, authenticated, service_role;

create or replace function public.rate_limit_session_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'invite_player',
    10,
    300,
    coalesce(new.session_id::text, 'unknown-session')
  );

  return new;
end;
$$;

revoke all on function public.rate_limit_session_invites() from public, anon, authenticated;

drop trigger if exists session_invites_rate_limit_writes on public.session_invites;
create trigger session_invites_rate_limit_writes
before insert or update on public.session_invites
for each row
when (new.status = 'pending')
execute function public.rate_limit_session_invites();

create or replace function public.rate_limit_session_creates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt',
    3,
    60,
    'session:' || coalesce(new.date::text, 'unknown-date') || ':' || coalesce(new.start_time::text, 'unknown-time')
  );

  return new;
end;
$$;

revoke all on function public.rate_limit_session_creates() from public, anon, authenticated;

drop trigger if exists sessions_rate_limit_creates on public.sessions;
create trigger sessions_rate_limit_creates
before insert on public.sessions
for each row
execute function public.rate_limit_session_creates();

create or replace function public.rate_limit_staff_config_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  perform public.consume_rate_limit(
    'staff_config_write',
    20,
    600,
    tg_table_name
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.rate_limit_staff_config_write() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'staff_discount_rules',
    'staff_pricing_rules',
    'staff_games',
    'staff_loyalty_rules'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists %I on public.%I', v_table || '_rate_limit_config_writes', v_table);
      execute format(
        'create trigger %I before insert or update or delete on public.%I for each row execute function public.rate_limit_staff_config_write()',
        v_table || '_rate_limit_config_writes',
        v_table
      );
    end if;
  end loop;
end $$;

create or replace function public.ticket_discount_code_quote(
  p_code text,
  p_booking_date date,
  p_subtotal integer,
  p_unit_price integer,
  p_game_id text default null,
  p_player_count integer default null,
  p_start_time time default null,
  p_ticket_type text default null
)
returns table (
  discount_code text,
  discount_name text,
  discount_amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_discount public.staff_discount_rules%rowtype;
  v_discount_amount integer := 0;
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
  v_requested_price_rule_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  if v_code is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  perform public.consume_rate_limit(
    'voucher_quote',
    20,
    600,
    'quote:' || auth.uid()::text
  );

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

  select *
  into v_discount
  from public.staff_discount_rules
  where code is not null
    and lower(btrim(code)) = lower(v_code)
    and active = true
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (max_uses is null or used_count < max_uses)
    and public.staff_discount_rule_matches_context(
      game_id,
      price_rule_id,
      min_players,
      max_players,
      day_scope,
      time_start,
      time_end,
      ticket_type,
      min_order_total,
      per_customer_limit,
      id,
      p_game_id,
      v_requested_price_rule_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      auth.uid()
    )
  order by created_at desc
  limit 1;

  if not found then
    perform public.consume_rate_limit(
      'voucher_quote',
      5,
      600,
      'invalid:' || auth.uid()::text || ':' || left(v_code, 64)
    );
    return;
  end if;

  v_discount_amount := public.staff_discount_rule_amount(
    v_discount.discount_type,
    v_discount.value,
    v_subtotal,
    p_unit_price,
    v_discount.max_discount_amount
  );

  if v_discount_amount <= 0 then
    perform public.consume_rate_limit(
      'voucher_quote',
      5,
      600,
      'invalid:' || auth.uid()::text || ':' || left(v_code, 64)
    );
    return;
  end if;

  return query
  select v_discount.code, v_discount.name, v_discount_amount;
end;
$$;

revoke all on function public.ticket_discount_code_quote(text, date, integer, integer, text, integer, time, text) from public, anon;
grant execute on function public.ticket_discount_code_quote(text, date, integer, integer, text, integer, time, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
