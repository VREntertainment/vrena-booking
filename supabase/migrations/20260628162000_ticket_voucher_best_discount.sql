create or replace function public.ticket_discount_code_quote(
  p_code text,
  p_booking_date date,
  p_subtotal integer,
  p_unit_price integer
)
returns table (
  discount_code text,
  discount_name text,
  discount_amount integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_discount public.staff_discount_rules%rowtype;
  v_discount_amount integer := 0;
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  if v_code is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  select *
  into v_discount
  from public.staff_discount_rules
  where code is not null
    and lower(btrim(code)) = lower(v_code)
    and active = true
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (max_uses is null or used_count < max_uses)
  limit 1;

  if not found then
    return;
  end if;

  if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
    v_discount_amount := round(v_subtotal * least(v_discount.value, 100) / 100)::integer;
  elsif v_discount.discount_type = 'fixed_amount' then
    v_discount_amount := v_discount.value::integer;
  elsif v_discount.discount_type = 'free_ticket' then
    v_discount_amount := greatest(coalesce(p_unit_price, 0), 0);
  end if;

  v_discount_amount := least(v_subtotal, greatest(0, v_discount_amount));

  if v_discount_amount <= 0 then
    return;
  end if;

  return query
  select v_discount.code, v_discount.name, v_discount_amount;
end;
$$;

drop function if exists public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer);

create or replace function public.create_ticket_booking(
  p_ticket_type text,
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_player_count integer,
  p_arena_count integer,
  p_game_options text[],
  p_unit_price integer,
  p_total_price integer,
  p_loyalty_points_to_redeem integer default 0,
  p_discount_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_session_id uuid;
  v_ticket_reference text;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_game_options text[] := coalesce(nullif(p_game_options, array[]::text[]), array['laser-tag']);
  v_default_game text;
  v_discount public.staff_discount_rules%rowtype;
  v_discount_code text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
  v_discount_source text := 'automatic';
  v_auto_discount_rate numeric := 0;
  v_auto_discount integer := 0;
  v_duration_blocks integer;
  v_charged_players_per_block integer;
  v_charged_player_spots integer;
  v_expected_unit_price integer;
  v_expected_gross integer;
  v_expected_subtotal integer;
  v_expected_total integer;
  v_voucher_discount integer := 0;
  v_applied_discount integer := 0;
  v_applied_discount_code text := null;
  v_loyalty_points_to_redeem integer := greatest(0, coalesce(p_loyalty_points_to_redeem, 0));
  v_redeem_value integer := 0;
  v_loyalty_discount integer := 0;
  v_loyalty_balance_after integer := null;
begin
  if v_user_id is null then
    raise exception 'Login required to book tickets.';
  end if;

  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_player_count < 1 or p_player_count > 16 then
    raise exception 'Invalid player count.';
  end if;

  if p_ticket_type = 'birthday' and p_player_count < 4 then
    raise exception 'Birthday bookings need at least 4 players.';
  end if;

  if p_ticket_type = 'corporate' and p_player_count < 6 then
    raise exception 'Corporate bookings need at least 6 players.';
  end if;

  if p_arena_count <> 1 then
    raise exception 'Ticket bookings reserve exactly one arena.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % 20 <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if (p_date + p_start_time) <= now() then
    raise exception 'Selected time is already past.';
  end if;

  v_expected_unit_price := case
    when extract(dow from p_date)::integer in (0, 6) then 330000
    when v_start_minutes >= 18 * 60 then 250000
    else 200000
  end;

  if p_unit_price <> v_expected_unit_price then
    raise exception 'Ticket unit price does not match the selected tariff.';
  end if;

  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / 20)::integer);
  v_charged_players_per_block := case
    when p_player_count <= 4 then p_player_count
    else 4
  end;
  v_charged_player_spots := v_duration_blocks * v_charged_players_per_block;
  v_expected_gross := v_expected_unit_price * v_charged_player_spots;

  if p_player_count > 8 then
    v_auto_discount_rate := 0.15;
  elsif p_player_count > 4 then
    v_auto_discount_rate := 0.10;
  end if;

  if p_ticket_type = 'birthday' then
    v_auto_discount_rate := greatest(v_auto_discount_rate, 0.10);
  end if;

  v_auto_discount := least(v_expected_gross, greatest(0, round(v_expected_gross * v_auto_discount_rate)::integer));

  if v_discount_code is not null then
    select *
    into v_discount
    from public.staff_discount_rules
    where code is not null
      and lower(btrim(code)) = lower(v_discount_code)
      and active = true
      and valid_from <= p_date
      and (valid_until is null or valid_until >= p_date)
    for update;

    if not found then
      raise exception 'Discount code is not valid for this booking.';
    end if;

    if v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses then
      raise exception 'Discount code use limit reached.';
    end if;

    if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
      v_voucher_discount := round(v_expected_gross * least(v_discount.value, 100) / 100)::integer;
    elsif v_discount.discount_type = 'fixed_amount' then
      v_voucher_discount := v_discount.value::integer;
    elsif v_discount.discount_type = 'free_ticket' then
      v_voucher_discount := v_expected_unit_price;
    end if;

    v_voucher_discount := least(v_expected_gross, greatest(0, v_voucher_discount));

    if v_loyalty_points_to_redeem > 0 then
      raise exception 'Loyalty points cannot be used together with voucher or discount codes. The best price reduction is used automatically.';
    end if;
  end if;

  if v_voucher_discount > v_auto_discount then
    v_applied_discount := v_voucher_discount;
    v_applied_discount_code := v_discount.code;
    v_discount_source := 'voucher';
  else
    v_applied_discount := v_auto_discount;
  end if;

  v_expected_subtotal := greatest(0, v_expected_gross - v_applied_discount);

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile required to book tickets.';
  end if;

  if v_loyalty_points_to_redeem > 0 then
    select coalesce(max(r.redeem_value_vnd_per_point), 0)
    into v_redeem_value
    from public.staff_loyalty_rules r
    where r.active = true
      and r.redeem_value_vnd_per_point > 0
      and r.valid_from <= p_date
      and (r.valid_until is null or r.valid_until >= p_date)
      and (r.game_id is null or r.game_id = coalesce(v_game_options[1], 'laser-tag'));

    if coalesce(v_redeem_value, 0) <= 0 then
      raise exception 'Loyalty redemption is not available for this booking.';
    end if;

    if v_loyalty_points_to_redeem > coalesce(v_profile.loyalty_points_total, 0) then
      raise exception 'Not enough loyalty points.';
    end if;

    if (v_loyalty_points_to_redeem * v_redeem_value) > v_expected_subtotal then
      raise exception 'Too many loyalty points for this ticket total.';
    end if;

    v_loyalty_discount := v_loyalty_points_to_redeem * v_redeem_value;
  end if;

  v_expected_total := greatest(0, v_expected_subtotal - v_loyalty_discount);

  if p_total_price <> v_expected_total then
    raise exception 'Ticket price does not match the reserved capacity, discount, and loyalty redemption.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where date = p_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_start_minutes < (
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
  where date = p_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_start_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < 1 then
    raise exception 'Selected time slot is no longer available.';
  end if;

  if v_discount_source = 'voucher' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  end if;

  v_default_game := coalesce(v_game_options[1], 'laser-tag');
  v_ticket_reference := 'TKT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
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
    v_user_id,
    null,
    'game',
    'Ticket booking - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    1,
    v_game_options,
    jsonb_build_object(v_user_id::text, v_default_game),
    v_default_game,
    'private',
    v_invite_code,
    'Private ticket booking',
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
    p_ticket_type,
    p_player_count,
    v_expected_unit_price,
    v_expected_total,
    'confirmed',
    v_ticket_reference,
    v_user_id
  )
  returning id into v_session_id;

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
    v_user_id,
    coalesce(v_profile.nickname, v_profile.full_name, v_profile.phone, 'Player'),
    v_profile.avatar_url,
    v_profile.avatar_emoji,
    v_profile.avatar_initials,
    v_profile.avatar_color,
    v_profile.avatar_text_color,
    v_profile.profile_motto,
    v_expected_total
  );

  if v_loyalty_points_to_redeem > 0 then
    select result.loyalty_points_total
    into v_loyalty_balance_after
    from public.apply_loyalty_points_delta(
      v_user_id,
      -v_loyalty_points_to_redeem,
      null,
      'ticket_redemption',
      v_session_id,
      'Ticket loyalty redemption',
      v_user_id
    ) as result;
  else
    v_loyalty_balance_after := coalesce(v_profile.loyalty_points_total, 0);
  end if;

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'confirmed',
    'discount_code', v_applied_discount_code,
    'discount_amount', case when v_discount_source = 'voucher' then v_applied_discount else 0 end,
    'discount_source', v_discount_source,
    'loyalty_points_total', v_loyalty_balance_after,
    'loyalty_points_redeemed', v_loyalty_points_to_redeem,
    'loyalty_discount_amount', v_loyalty_discount
  );
end;
$$;

revoke all on function public.ticket_discount_code_quote(text, date, integer, integer) from public, anon;
revoke all on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer, text) from public, anon;

grant execute on function public.ticket_discount_code_quote(text, date, integer, integer) to authenticated, service_role;
grant execute on function public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
