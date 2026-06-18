drop function if exists public.create_staff_order(
  uuid,
  text,
  text,
  text,
  uuid,
  date,
  time,
  integer,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.create_staff_order(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_game_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_players_count integer,
  p_arena_id text,
  p_discount_rule_id uuid,
  p_payment_method text,
  p_payment_status text,
  p_order_status text,
  p_invoice_required boolean default false,
  p_company_name text default null,
  p_tax_code text default null,
  p_invoice_email text default null,
  p_invoice_address text default null,
  p_internal_note text default null,
  p_manual_discount_type text default null,
  p_manual_discount_value numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := (select auth.uid());
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

  v_booking_minutes := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_minutes := v_booking_minutes + v_game.duration_minutes;
  v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer);

  if v_booking_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where date = p_booking_date
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
  where date = p_booking_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_booking_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

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

    v_discount_total := least(v_subtotal, greatest(0, v_discount_total));

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
    'order_id', v_order_id,
    'order_number', v_order_number,
    'session_id', v_session_id,
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'total', v_total
  );
end;
$$;

revoke all on function public.create_staff_order(
  uuid,
  text,
  text,
  text,
  uuid,
  date,
  time,
  integer,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric
) from public, anon;

grant execute on function public.create_staff_order(
  uuid,
  text,
  text,
  text,
  uuid,
  date,
  time,
  integer,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric
) to authenticated, service_role;
