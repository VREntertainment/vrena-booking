-- Canonicalize local Vietnam and international phone formats only for staff booking identity checks.
create or replace function private.staff_booking_phone(p_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_phone text := regexp_replace(regexp_replace(btrim(coalesce(p_phone, '')), '[^0-9+]', '', 'g'), '(?!^)\+', '', 'g');
begin
  if v_phone = '' then return null; end if;
  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;
  if v_phone not like '+%' then
    v_phone := case when v_phone like '84%' then '+' || v_phone
      when v_phone like '0%' then '+84' || substr(v_phone, 2)
      else '+84' || v_phone end;
  end if;
  if v_phone like '+840%' then v_phone := '+84' || ltrim(substr(v_phone, 4), '0'); end if;
  return v_phone;
end;
$$;
revoke all on function private.staff_booking_phone(text) from public, anon, authenticated;

-- Staff booking: atomic client creation and venue-scoped game, tariff and capacity checks.
-- Existing RPC signatures and grants are retained.

CREATE OR REPLACE FUNCTION "public"."create_staff_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_customer_email" "text", "p_game_id" "uuid", "p_booking_date" "date", "p_booking_time" time without time zone, "p_players_count" integer, "p_arena_id" "text", "p_discount_rule_id" "uuid", "p_payment_method" "text", "p_payment_status" "text", "p_order_status" "text", "p_invoice_required" boolean DEFAULT false, "p_company_name" "text" DEFAULT NULL::"text", "p_tax_code" "text" DEFAULT NULL::"text", "p_invoice_email" "text" DEFAULT NULL::"text", "p_invoice_address" "text" DEFAULT NULL::"text", "p_internal_note" "text" DEFAULT NULL::"text", "p_manual_discount_type" "text" DEFAULT NULL::"text", "p_manual_discount_value" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_staff_id uuid := (select auth.uid());
  v_venue_key text := case when p_arena_id = 'cafe:arena-1' then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;
  v_profile_id uuid;
  v_identity text;
  v_phone text := nullif(private.staff_booking_phone(p_customer_phone), '');
  v_email text := nullif(lower(btrim(coalesce(p_customer_email, ''))), '');
  v_game public.staff_games%rowtype;
  v_rule public.staff_pricing_rules%rowtype;
  v_discount public.staff_discount_rules%rowtype;
  v_customer public.profiles%rowtype;
  v_booking_minutes integer;
  v_end_minutes integer;
  v_duration_blocks integer;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_total integer := 0;
  v_discount_code text := null;
  v_session_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_game_slug text;
  v_invite_code text;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_display_name text;
  v_manual_discount_type text := nullif(btrim(coalesce(p_manual_discount_type, '')), '');
  v_manual_discount_value numeric := greatest(0, coalesce(p_manual_discount_value, 0));
begin
  if v_staff_id is null or not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_game_id is null or p_booking_date is null or p_booking_time is null then
    raise exception 'Game, date, and time are required.';
  end if;

  if p_players_count is null or p_players_count < 1 or p_players_count > 64 then
    raise exception 'Invalid player count.';
  end if;

  if p_payment_method not in ('cash', 'bank_transfer', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid') then
    raise exception 'Invalid payment method.';
  end if;

  if p_payment_status not in ('unpaid', 'partially_paid', 'paid', 'refunded') then
    raise exception 'Invalid payment status.';
  end if;

  if p_order_status not in ('draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed') then
    raise exception 'Invalid order status.';
  end if;

  if p_discount_rule_id is not null and v_manual_discount_type is not null and v_manual_discount_value > 0 then
    raise exception 'Use either a saved voucher or a unique discount, not both.';
  end if;

  if v_manual_discount_type is not null and v_manual_discount_type not in ('fixed_amount', 'percentage') then
    raise exception 'Invalid unique discount type.';
  end if;

  if v_manual_discount_value > 0 and v_manual_discount_type is null then
    raise exception 'Unique discount type is required.';
  end if;

  select *
  into v_game
  from public.staff_games
  where id = p_game_id
    and active = true;

  if not found then
    raise exception 'Active game not found.';
  end if;

  -- Keep the existing RPC signature; the arena identifies the shop as well as the room.
  if v_venue_key = 'cafe-des-stagiaires' then
    if v_game.slug not in ('revolta', 'city-z', 'station-zarya') then
      raise exception 'This game is not available at the selected shop.';
    end if;
  elsif p_arena_id is null or not (p_arena_id = any(coalesce(v_game.available_arena_ids, array['arena-1']))) then
    raise exception 'Choose an available arena for this game.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('staff_booking:' || v_venue_key || ':' || p_booking_date::text, 0));

  -- Named walk-ins become reusable profiles in the same transaction as the order.
  -- Guest bookings pass no identity and continue to create no profile or participant.
  if p_customer_id is null and nullif(btrim(p_customer_name), '') is not null then
    if length(btrim(p_customer_name)) > 120 then raise exception 'Customer name must be 120 characters or fewer.'; end if;
    if v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) not between 8 and 15 then
      raise exception 'Enter a valid phone number or leave it empty.';
    end if;
    if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'Enter a valid email address or leave it empty.';
    end if;
    for v_identity in select unnest(array[v_phone, v_email]) order by 1 loop
      if v_identity is not null then
        perform pg_advisory_xact_lock(hashtextextended('staff_customer:' || v_identity, 0));
      end if;
    end loop;
    if exists (
      select 1 from public.profiles p where p.deleted_at is null and not p.is_hr_record_only
        and ((v_phone is not null and private.staff_booking_phone(p.phone) = v_phone)
          or (v_email is not null and lower(btrim(p.email)) = v_email))
    ) then
      raise exception 'A profile already uses these contact details. Select the existing client from the name dropdown.';
    end if;
    v_profile_id := gen_random_uuid();
    -- Match existing guest-ticket identity storage: no password, verified contact, consent or email invitation.
    insert into auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new,
      email_change, phone_change, phone_change_token, email_change_token_current,
      email_change_confirm_status, reauthentication_token
    ) values (
      v_profile_id, 'authenticated', 'authenticated',
      'guest-ticket-' || replace(v_profile_id::text, '-', '') || '@vrena.guest.invalid', null,
      jsonb_build_object('provider', 'guest_ticket', 'providers', jsonb_build_array('guest_ticket'), 'guest_ticket', true),
      jsonb_build_object('full_name', btrim(p_customer_name), 'phone', v_phone, 'guest_ticket', true, 'staff_created', true),
      now(), now(), '', '', '', '', '', '', '', 0, ''
    );
    insert into public.profiles (id, full_name, phone, email, role, marketing_consent)
    values (v_profile_id, btrim(p_customer_name), v_phone, v_email, 'player', false);
    p_customer_id := v_profile_id;
    p_customer_phone := v_phone;
    p_customer_email := v_email;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id)
    values (v_staff_id, 'staff_booking_customer_created', 'profiles', v_profile_id);
  elsif p_customer_id is not null and not exists (
    select 1 from public.profiles where id = p_customer_id and deleted_at is null and not is_hr_record_only
  ) then
    raise exception 'Customer profile is no longer available. Select another client.';
  end if;

  select *
  into v_rule
  from public.staff_pricing_rules
  where active = true
    and (game_id is null or game_id = p_game_id)
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (
      day_type = 'custom'
      or (day_type = 'holiday' and p_booking_date between valid_from and coalesce(valid_until, valid_from))
      or (day_type = 'weekend' and extract(isodow from p_booking_date) in (6, 7))
      or (day_type = 'weekday' and extract(isodow from p_booking_date) between 1 and 5)
    )
    and (time_start is null or p_booking_time >= time_start)
    and (time_end is null or p_booking_time < time_end)
  order by
    case when game_id = p_game_id then 0 else 1 end,
    case when day_type in ('custom', 'holiday') then 0 else 1 end,
    valid_from desc,
    created_at desc
  limit 1;

  if not found then
    v_rule.price_per_player := 200000;
    v_rule.price_per_arena_slot := null;
  end if;

  if v_venue_key = 'cafe-des-stagiaires' then
    v_rule.id := null;
    v_rule.price_per_arena_slot := null;
    v_rule.price_per_player := public.ticket_tariff_unit_price(v_venue_key, 'individual', p_booking_date, p_booking_time);
  end if;

  v_booking_minutes := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_minutes := v_booking_minutes + v_game.duration_minutes;
  v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer);

  if v_booking_minutes < (case when v_venue_key = 'cafe-des-stagiaires' then 16 else 9 end) * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where venue_key = v_venue_key
      and date = p_booking_date
      and deleted_at is null
      and coalesce(ticket_status, '') not in ('cancelled', 'expired')
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_booking_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where v_venue_key = 'ha-do-centrosa'
    and date = p_booking_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_booking_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := (case when v_venue_key = 'cafe-des-stagiaires' then 1 else 2 end) - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if exists (
    select 1 from public.staff_orders o join public.sessions s on s.id = o.session_id
    where o.arena_id = p_arena_id and s.venue_key = v_venue_key and s.date = p_booking_date
      and s.deleted_at is null and s.status = 'open' and coalesce(s.ticket_status, '') not in ('cancelled', 'expired')
      and s.start_time::time < p_booking_time + make_interval(mins => v_game.duration_minutes)
      and p_booking_time < s.start_time::time + make_interval(mins => s.duration_minutes)
  ) then
    raise exception 'This arena is already booked at the selected time. Choose another arena or time.';
  end if;

  if v_remaining_arenas < 1 then
    raise exception 'Selected time slot is no longer available.';
  end if;

  if v_rule.price_per_arena_slot is not null then
    v_subtotal := v_duration_blocks * v_rule.price_per_arena_slot;
  else
    v_subtotal := greatest(0, coalesce(v_rule.price_per_player, 0)) * p_players_count;
  end if;

  if p_discount_rule_id is not null then
    select *
    into v_discount
    from public.staff_discount_rules
    where id = p_discount_rule_id
      and active = true
      and valid_from <= p_booking_date
      and (valid_until is null or valid_until >= p_booking_date)
      and public.staff_discount_rule_matches_context(
        game_id,
        v_rule.id,
        min_players,
        max_players,
        day_scope,
        time_start,
        time_end,
        ticket_type,
        min_order_total,
        per_customer_limit,
        id,
        p_game_id::text,
        v_rule.id,
        p_booking_date,
        p_booking_time,
        p_players_count,
        v_subtotal,
        'individual',
        p_customer_id
      )
    for update;

    if not found then
      raise exception 'Discount is not active.';
    end if;

    if v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses then
      raise exception 'Discount use limit reached.';
    end if;

    v_discount_code := v_discount.code;
    if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
      v_discount_total := round(v_subtotal * least(v_discount.value, 100) / 100)::integer;
    elsif v_discount.discount_type = 'fixed_amount' then
      v_discount_total := v_discount.value::integer;
    elsif v_discount.discount_type = 'free_ticket' then
      v_discount_total := greatest(coalesce(v_rule.price_per_player, 0), 0);
    end if;

    v_discount_total := public.staff_discount_rule_amount(
      v_discount.discount_type,
      v_discount.value,
      v_subtotal,
      coalesce(v_rule.price_per_player, 0),
      v_discount.max_discount_amount
    );

    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_manual_discount_type is not null and v_manual_discount_value > 0 then
    if v_manual_discount_type = 'percentage' then
      v_discount_total := round(v_subtotal * least(v_manual_discount_value, 100) / 100)::integer;
      v_discount_code := 'Manual ' || trim(to_char(least(v_manual_discount_value, 100), 'FM999990.##')) || '%';
    elsif v_manual_discount_type = 'fixed_amount' then
      v_discount_total := round(v_manual_discount_value)::integer;
      v_discount_code := 'Manual ' || round(v_manual_discount_value)::integer::text || ' VND';
    end if;

    v_discount_total := least(v_subtotal, greatest(0, v_discount_total));
  end if;

  v_total := greatest(0, v_subtotal - v_discount_total);
  v_game_slug := coalesce(nullif(v_game.slug, ''), replace(lower(v_game.name), ' ', '-'));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
    venue_key,
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
    v_venue_key,
    v_staff_id,
    null,
    'game',
    'Staff booking - ' || v_game.name,
    p_booking_date,
    p_booking_time,
    v_game.duration_minutes,
    p_players_count,
    1,
    array[v_game_slug],
    jsonb_build_object(v_staff_id::text, v_game_slug),
    v_game_slug,
    'private',
    v_invite_code,
    nullif(concat_ws(' · ', 'Staff Console', p_internal_note), ''),
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
    p_players_count,
    coalesce(v_rule.price_per_player, 0),
    v_total,
    case when p_order_status in ('cancelled', 'refunded') then 'cancelled' else 'confirmed' end,
    'POS-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    p_customer_id
  )
  returning id into v_session_id;

  if p_customer_id is not null then
    select *
    into v_customer
    from public.profiles
    where id = p_customer_id;

    if found then
      v_display_name := coalesce(v_customer.nickname, v_customer.full_name, v_customer.phone, v_customer.email, 'Customer');
      insert into public.session_participants (
        session_id,
        profile_id,
        display_name,
        avatar_url,
        avatar_emoji,
        avatar_initials,
        avatar_color,
        avatar_text_color,
        profile_motto,
        payment_amount
      ) values (
        v_session_id,
        p_customer_id,
        v_display_name,
        v_customer.avatar_url,
        v_customer.avatar_emoji,
        v_customer.avatar_initials,
        v_customer.avatar_color,
        v_customer.avatar_text_color,
        v_customer.profile_motto,
        v_total
      )
      on conflict do nothing;
    end if;
  end if;

  insert into public.staff_orders (
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
    created_by,
    invoice_required,
    company_name,
    tax_code,
    invoice_email,
    invoice_address,
    invoice_status,
    internal_note
  ) values (
    p_customer_id,
    nullif(btrim(p_customer_name), ''),
    nullif(btrim(p_customer_phone), ''),
    nullif(btrim(p_customer_email), ''),
    p_game_id,
    v_session_id,
    p_booking_date,
    p_booking_time,
    p_players_count,
    nullif(btrim(p_arena_id), ''),
    v_subtotal,
    p_discount_rule_id,
    v_discount_code,
    v_discount_total,
    v_total,
    p_payment_method,
    p_payment_status,
    p_order_status,
    v_staff_id,
    coalesce(p_invoice_required, false),
    nullif(btrim(p_company_name), ''),
    nullif(btrim(p_tax_code), ''),
    nullif(btrim(p_invoice_email), ''),
    nullif(btrim(p_invoice_address), ''),
    case when coalesce(p_invoice_required, false) then 'pending' else 'not_requested' end,
    nullif(btrim(p_internal_note), '')
  )
  returning id, order_number into v_order_id, v_order_number;

  return jsonb_build_object(
    'customer_id', p_customer_id,
    'venue_key', v_venue_key,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'session_id', v_session_id,
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'total', v_total
  );
end;
$$;

