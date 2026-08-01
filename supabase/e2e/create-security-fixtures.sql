-- Local/staging only. Do not run this against production.
--
-- Creates deterministic fake accounts and fake rows used by the direct REST
-- security regression tests. Run after all migrations on a non-production
-- Supabase project:
--
-- select public.vrena_e2e_prepare_security_fixtures(
--   'security-player@vrena.local',
--   'replace-with-a-long-test-only-password',
--   'security-staff@vrena.local',
--   'replace-with-a-long-test-only-password',
--   true
-- );

create extension if not exists pgcrypto with schema extensions;

create or replace function public.vrena_e2e_prepare_security_fixtures(
  p_player_email text,
  p_player_password text,
  p_staff_email text,
  p_staff_password text,
  p_allow_non_production boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_player_email text := lower(nullif(btrim(coalesce(p_player_email, '')), ''));
  v_staff_email text := lower(nullif(btrim(coalesce(p_staff_email, '')), ''));
  v_player_id uuid := '00000000-0000-4000-8000-00000000e201';
  v_staff_id uuid := '00000000-0000-4000-8000-00000000e202';
  v_game_id uuid := '00000000-0000-4000-8000-00000000e301';
  v_price_rule_id uuid := '00000000-0000-4000-8000-00000000e302';
  v_discount_rule_id uuid := '00000000-0000-4000-8000-00000000e303';
  v_order_id uuid := '00000000-0000-4000-8000-00000000e304';
  v_ticket_session_id uuid := '00000000-0000-4000-8000-00000000e305';
  v_attendance_log_id uuid := '00000000-0000-4000-8000-00000000e306';
begin
  if p_allow_non_production is distinct from true then
    raise exception 'Refusing to create security fixtures. Pass true only on local/staging.';
  end if;

  if v_player_email is null or v_player_email !~ '^[a-z0-9._%+\-]+@vrena\.local$' then
    raise exception 'Security player email must use the @vrena.local test domain.';
  end if;

  if v_staff_email is null or v_staff_email !~ '^[a-z0-9._%+\-]+@vrena\.local$' then
    raise exception 'Security staff email must use the @vrena.local test domain.';
  end if;

  if v_player_email = v_staff_email then
    raise exception 'Security player and staff emails must be different.';
  end if;

  if coalesce(length(p_player_password), 0) < 12 or coalesce(length(p_staff_password), 0) < 12 then
    raise exception 'Security fixture passwords must be at least 12 characters.';
  end if;

  if to_regclass('auth.users') is null or to_regclass('auth.identities') is null then
    raise exception 'Missing required Supabase Auth tables.';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(email) in (v_player_email, v_staff_email)
      and id not in (v_player_id, v_staff_id)
  ) then
    raise exception 'One of the security fixture emails already belongs to another user.';
  end if;

  delete from public.staff_discount_rules
  where lower(code) = 'securityfixture'
    and id <> v_discount_rule_id;

  delete from public.staff_orders
  where order_number = 'SEC-FIXTURE-ORDER'
    and id <> v_order_id;

  delete from public.sessions
  where ticket_reference = 'SEC-FIXTURE-001'
    and id <> v_ticket_session_id;

  delete from public.staff_games
  where slug = 'security-fixture-game'
    and id <> v_game_id;

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    reauthentication_token
  ) values
  (
    v_player_id,
    'authenticated',
    'authenticated',
    v_player_email,
    crypt(p_player_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'e2e_security_user', true),
    jsonb_build_object('full_name', 'Security Player', 'nickname', 'Security Player', 'e2e_security_user', true),
    now(),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    ''
  ),
  (
    v_staff_id,
    'authenticated',
    'authenticated',
    v_staff_email,
    crypt(p_staff_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'e2e_security_user', true),
    jsonb_build_object('full_name', 'Security Staff', 'nickname', 'Security Staff', 'e2e_security_user', true),
    now(),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    ''
  )
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values
  (
    v_player_id,
    v_player_id,
    v_player_id::text,
    jsonb_build_object('sub', v_player_id::text, 'email', v_player_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  ),
  (
    v_staff_id,
    v_staff_id,
    v_staff_id::text,
    jsonb_build_object('sub', v_staff_id::text, 'email', v_staff_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    role,
    score_adjustment,
    loyalty_points_total,
    updated_at
  ) values
  (
    v_player_id,
    '+84999000201',
    'Security Player',
    'Security Player',
    v_player_email,
    'player',
    0,
    0,
    now()
  ),
  (
    v_staff_id,
    '+84999000202',
    'Security Staff',
    'Security Staff',
    v_staff_email,
    'staff',
    0,
    0,
    now()
  )
  on conflict (id) do update
  set phone = excluded.phone,
      full_name = excluded.full_name,
      nickname = excluded.nickname,
      email = excluded.email,
      role = excluded.role,
      score_adjustment = 0,
      loyalty_points_total = 0,
      deleted_at = null,
      banned_at = null,
      updated_at = now();

  insert into public.staff_games (
    id,
    slug,
    name,
    game_type,
    duration_minutes,
    max_players_per_arena,
    active,
    created_by
  ) values (
    v_game_id,
    'security-fixture-game',
    'Security Fixture Game',
    'other',
    20,
    4,
    true,
    v_staff_id
  )
  on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      game_type = excluded.game_type,
      duration_minutes = excluded.duration_minutes,
      max_players_per_arena = excluded.max_players_per_arena,
      active = true,
      created_by = excluded.created_by,
      updated_at = now();

  insert into public.staff_pricing_rules (
    id,
    rule_name,
    game_id,
    day_type,
    time_start,
    time_end,
    price_per_player,
    valid_from,
    valid_until,
    active,
    created_by
  ) values (
    v_price_rule_id,
    'Security Fixture Price Rule',
    v_game_id,
    'weekday',
    '09:00',
    '22:00',
    200000,
    current_date,
    null,
    true,
    v_staff_id
  )
  on conflict (id) do update
  set rule_name = excluded.rule_name,
      game_id = excluded.game_id,
      day_type = excluded.day_type,
      time_start = excluded.time_start,
      time_end = excluded.time_end,
      price_per_player = excluded.price_per_player,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until,
      active = true,
      created_by = excluded.created_by,
      updated_at = now();

  insert into public.staff_discount_rules (
    id,
    code,
    name,
    discount_type,
    value,
    valid_from,
    valid_until,
    max_uses,
    used_count,
    active,
    created_by
  ) values (
    v_discount_rule_id,
    'SECURITYFIXTURE',
    'Security Fixture Discount',
    'percentage',
    10,
    current_date,
    null,
    20,
    0,
    true,
    v_staff_id
  )
  on conflict (id) do update
  set code = excluded.code,
      name = excluded.name,
      discount_type = excluded.discount_type,
      value = excluded.value,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until,
      max_uses = excluded.max_uses,
      used_count = 0,
      active = true,
      created_by = excluded.created_by,
      updated_at = now();

  insert into public.sessions (
    id,
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  ) values (
    v_ticket_session_id,
    v_staff_id,
    null,
    'game',
    'Security Fixture Ticket',
    current_date + 14,
    '10:00',
    20,
    1,
    1,
    array['security-fixture-game']::text[],
    jsonb_build_object(v_player_id::text, 'security-fixture-game'),
    'security-fixture-game',
    'private',
    'SECFIX',
    'Security fixture ticket booking',
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'ticket',
    'individual',
    1,
    200000,
    200000,
    'confirmed',
    'SEC-FIXTURE-001',
    v_player_id
  )
  on conflict (id) do update
  set owner_id = excluded.owner_id,
      name = excluded.name,
      date = excluded.date,
      start_time = excluded.start_time,
      duration_minutes = excluded.duration_minutes,
      max_players = excluded.max_players,
      arena_count = excluded.arena_count,
      game_options = excluded.game_options,
      game_votes = excluded.game_votes,
      confirmed_game_id = excluded.confirmed_game_id,
      visibility = excluded.visibility,
      invite_code = excluded.invite_code,
      notes = excluded.notes,
      status = excluded.status,
      booking_type = excluded.booking_type,
      ticket_type = excluded.ticket_type,
      ticket_player_count = excluded.ticket_player_count,
      ticket_unit_price = excluded.ticket_unit_price,
      ticket_total_price = excluded.ticket_total_price,
      ticket_status = excluded.ticket_status,
      ticket_reference = excluded.ticket_reference,
      ticket_customer_id = excluded.ticket_customer_id,
      deleted_at = null,
      deleted_by = null,
      delete_reason = null;

  insert into public.session_participants (
    session_id,
    profile_id,
    display_name,
    payment_amount,
    checked_in,
    payment_status,
    checked_in_at
  ) values (
    v_ticket_session_id,
    v_player_id,
    'Security Player',
    200000,
    false,
    null,
    null
  )
  on conflict (session_id, profile_id) do update
  set display_name = excluded.display_name,
      payment_amount = excluded.payment_amount,
      checked_in = false,
      payment_status = null,
      checked_in_at = null,
      deleted_at = null,
      deleted_by = null,
      delete_reason = null;

  insert into public.staff_orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    game_id,
    session_id,
    booking_date,
    booking_time,
    players_count,
    arena_id,
    subtotal,
    discount_rule_id,
    discount_code,
    discount_total,
    total,
    payment_method,
    payment_status,
    order_status,
    created_by
  ) values (
    v_order_id,
    'SEC-FIXTURE-ORDER',
    v_player_id,
    'Security Player',
    '+84999000201',
    v_player_email,
    v_game_id,
    v_ticket_session_id,
    current_date + 14,
    '10:00',
    1,
    'arena-1',
    200000,
    null,
    null,
    0,
    200000,
    'unpaid',
    'unpaid',
    'confirmed',
    v_staff_id
  )
  on conflict (id) do update
  set customer_id = excluded.customer_id,
      game_id = excluded.game_id,
      session_id = excluded.session_id,
      booking_date = excluded.booking_date,
      booking_time = excluded.booking_time,
      subtotal = excluded.subtotal,
      discount_total = excluded.discount_total,
      total = excluded.total,
      payment_method = excluded.payment_method,
      payment_status = excluded.payment_status,
      order_status = excluded.order_status,
      created_by = excluded.created_by,
      updated_at = now();

  if to_regclass('public.staff_employee_profiles') is not null then
    insert into public.staff_employee_profiles (
      profile_id,
      employee_code,
      legal_name,
      personal_email,
      personal_phone,
      job_title,
      employment_type,
      active,
      created_by
    ) values (
      v_staff_id,
      'SEC-FIX',
      'Security Staff',
      v_staff_email,
      '+84999000202',
      'Security Fixture Staff',
      'part_time',
      true,
      v_staff_id
    )
    on conflict (profile_id) do update
    set employee_code = excluded.employee_code,
        legal_name = excluded.legal_name,
        personal_email = excluded.personal_email,
        personal_phone = excluded.personal_phone,
        job_title = excluded.job_title,
        employment_type = excluded.employment_type,
        active = true,
        deleted_at = null,
        deleted_by = null,
        delete_reason = null,
        updated_at = now();
  end if;

  if to_regclass('public.staff_attendance_logs') is not null then
    insert into public.staff_attendance_logs (
      id,
      staff_profile_id,
      work_date,
      clock_in_at,
      clock_out_at,
      break_minutes,
      status,
      regular_minutes,
      overtime_minutes,
      night_minutes,
      holiday_minutes,
      manager_note,
      created_by
    ) values (
      v_attendance_log_id,
      v_staff_id,
      current_date,
      null,
      null,
      0,
      'present',
      0,
      0,
      0,
      0,
      'Security fixture attendance log',
      v_staff_id
    )
    on conflict (id) do update
    set staff_profile_id = excluded.staff_profile_id,
        work_date = excluded.work_date,
        status = excluded.status,
        regular_minutes = excluded.regular_minutes,
        overtime_minutes = excluded.overtime_minutes,
        night_minutes = excluded.night_minutes,
        holiday_minutes = excluded.holiday_minutes,
        manager_note = excluded.manager_note,
        deleted_at = null,
        deleted_by = null,
        delete_reason = null,
        updated_at = now();
  end if;

  return jsonb_build_object(
    'player_id', v_player_id,
    'staff_id', v_staff_id,
    'game_id', v_game_id,
    'price_rule_id', v_price_rule_id,
    'discount_rule_id', v_discount_rule_id,
    'order_id', v_order_id,
    'ticket_session_id', v_ticket_session_id,
    'attendance_log_id', v_attendance_log_id
  );
end;
$$;

revoke all on function public.vrena_e2e_prepare_security_fixtures(text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.vrena_e2e_prepare_security_fixtures(text, text, text, text, boolean) to service_role;
