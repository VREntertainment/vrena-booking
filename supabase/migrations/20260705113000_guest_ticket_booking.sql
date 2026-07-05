begin;

create index if not exists profiles_phone_lookup_idx
on public.profiles (phone)
where phone is not null and btrim(phone) <> '';

create or replace function public.create_guest_ticket_booking(
  p_ticket_type text,
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_player_count integer,
  p_arena_count integer,
  p_game_options text[],
  p_unit_price integer,
  p_total_price integer,
  p_guest_phone text,
  p_guest_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_customer public.profiles%rowtype;
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
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
  v_staff_game_id uuid;
  v_discount_rate numeric := 0;
  v_duration_blocks integer;
  v_charged_players_per_block integer;
  v_charged_player_spots integer;
  v_expected_unit_price integer;
  v_expected_total integer;
  v_order_id uuid;
  v_order_number text;
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
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
    when p_ticket_type <> 'individual' then 0
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

  if p_ticket_type = 'individual' then
    if p_player_count > 8 then
      v_discount_rate := 0.15;
    elsif p_player_count > 4 then
      v_discount_rate := 0.10;
    end if;

    v_expected_total := round((v_expected_unit_price * v_charged_player_spots)::numeric * (1 - v_discount_rate))::integer;
  else
    v_expected_total := 0;
  end if;

  if p_total_price <> v_expected_total then
    raise exception 'Ticket price does not match the reserved capacity.';
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

  select *
  into v_customer
  from public.profiles
  where phone = v_guest_phone
    and deleted_at is null
  order by created_at desc nulls last
  limit 1
  for update;

  if found then
    v_customer_id := v_customer.id;

    if v_guest_name is not null and nullif(btrim(coalesce(v_customer.full_name, '')), '') is null then
      update public.profiles
      set full_name = v_guest_name
      where id = v_customer_id;
      v_customer.full_name := v_guest_name;
    end if;
  else
    v_customer_id := gen_random_uuid();

    insert into public.profiles (
      id,
      phone,
      full_name,
      nickname,
      email,
      avatar_url,
      avatar_emoji,
      avatar_initials,
      avatar_color,
      avatar_text_color,
      profile_motto,
      role,
      score_adjustment,
      anonymous_mode,
      marketing_consent
    ) values (
      v_customer_id,
      v_guest_phone,
      v_guest_name,
      null,
      null,
      null,
      null,
      null,
      '#3059ff',
      '#ffffff',
      null,
      'player',
      0,
      false,
      false
    )
    returning * into v_customer;
  end if;

  v_default_game := coalesce(v_game_options[1], 'laser-tag');

  select id
  into v_staff_game_id
  from public.staff_games
  where lower(slug) = lower(v_default_game)
  limit 1;

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
    v_customer_id,
    null,
    'game',
    'Ticket booking - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    1,
    v_game_options,
    jsonb_build_object(v_customer_id::text, v_default_game),
    v_default_game,
    'private',
    v_invite_code,
    'Guest ticket booking',
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
    v_customer_id
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
    v_customer_id,
    coalesce(nullif(v_guest_name, ''), v_customer.nickname, v_customer.full_name, v_customer.phone, 'Guest'),
    v_customer.avatar_url,
    v_customer.avatar_emoji,
    v_customer.avatar_initials,
    v_customer.avatar_color,
    v_customer.avatar_text_color,
    v_customer.profile_motto,
    v_expected_total
  );

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
    invoice_status,
    internal_note
  ) values (
    v_customer_id,
    coalesce(v_guest_name, v_customer.full_name, v_customer.nickname),
    v_guest_phone,
    v_customer.email,
    v_staff_game_id,
    v_session_id,
    p_date,
    p_start_time,
    p_player_count,
    'arena-1',
    v_expected_total,
    null,
    null,
    0,
    v_expected_total,
    'unpaid',
    'unpaid',
    'confirmed',
    null,
    false,
    'not_requested',
    'Guest ticket booking. Reference: ' || v_ticket_reference
  )
  returning id, order_number into v_order_id, v_order_number;

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'confirmed',
    'guest_phone', v_guest_phone,
    'guest_name', coalesce(v_guest_name, v_customer.full_name, v_customer.nickname),
    'order_id', v_order_id,
    'order_number', v_order_number
  );
end;
$$;

revoke all on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
