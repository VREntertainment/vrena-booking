-- Keep existing Ha Do availability isolated from the new Cafe soft-opening
-- request inventory. Both functions predate sessions.venue_key, so patch their
-- session overlap predicate in place without changing their public signatures.
do $$
declare
  v_signature text;
  v_definition text;
  v_updated_definition text;
begin
  foreach v_signature in array array[
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)',
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'
  ]
  loop
    select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

    if v_definition is null then
      raise exception 'Required booking function not found: %', v_signature;
    end if;

    v_updated_definition := replace(
      v_definition,
      E'from public.sessions\n    where date = p_date',
      E'from public.sessions\n    where venue_key = ''ha-do-centrosa''\n      and date = p_date'
    );

    if v_updated_definition = v_definition then
      raise exception 'Could not add venue isolation to booking function: %', v_signature;
    end if;

    execute v_updated_definition;
  end loop;
end;
$$;

-- Include the venue in the session payloads used by the booking client. The
-- functions build explicit JSON objects, so newly added table columns are not
-- returned automatically.
do $$
declare
  v_signature text;
  v_definition text;
  v_updated_definition text;
begin
  foreach v_signature in array array[
    'public.sessions_list_page(date,date,integer,integer,boolean)',
    'public.session_detail(uuid)'
  ]
  loop
    select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

    if v_definition is null then
      raise exception 'Required session function not found: %', v_signature;
    end if;

    v_updated_definition := replace(
      v_definition,
      E'''id'', s.id,\n',
      E'''id'', s.id,\n        ''venue_key'', s.venue_key,\n'
    );

    if v_updated_definition = v_definition then
      raise exception 'Could not add venue_key to session function: %', v_signature;
    end if;

    execute v_updated_definition;
  end loop;
end;
$$;

create or replace function public.create_cafe_ticket_booking_request(
  p_ticket_type text,
  p_date date,
  p_start_time time without time zone,
  p_duration_minutes integer,
  p_player_count integer,
  p_arena_count integer,
  p_game_options text[],
  p_guest_phone text default null,
  p_guest_name text default null,
  p_special_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer public.profiles%rowtype;
  v_customer_id uuid;
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_special_note text := left(nullif(btrim(coalesce(p_special_note, '')), ''), 500);
  v_session_id uuid;
  v_ticket_reference text;
  v_invite_code text;
  v_start_minutes integer;
  v_end_minutes integer;
  v_duration_blocks integer;
  v_discount_rate numeric := 0;
  v_expected_unit_price integer;
  v_expected_total integer;
  v_game_options text[] := coalesce(nullif(p_game_options, array[]::text[]), array['laser-tag']);
begin
  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_date < date '2026-08-31' then
    raise exception 'Cafe des Stagiaires bookings open on August 31.';
  end if;

  if p_player_count < 1
    or (p_ticket_type = 'corporate' and p_player_count > 32)
    or (p_ticket_type <> 'corporate' and p_player_count > 16)
  then
    raise exception 'Invalid player count.';
  end if;

  if p_ticket_type = 'birthday' and p_player_count < 4 then
    raise exception 'Birthday bookings need at least 4 players.';
  end if;

  if p_ticket_type = 'corporate' and p_player_count < 6 then
    raise exception 'Corporate bookings need at least 6 players.';
  end if;

  if p_arena_count < 1 or p_arena_count > 2 then
    raise exception 'Ticket requests can include one or two arenas.';
  end if;

  if p_arena_count = 2 and p_player_count <= 4 then
    raise exception 'Two arenas require at least five players.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % 20 <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < ceil(p_player_count::numeric / (p_arena_count * 4))::integer * 20 then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60
    + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 16 * 60 or v_end_minutes > 24 * 60 then
    raise exception 'Selected time is outside Cafe des Stagiaires opening hours.';
  end if;

  if (p_date + p_start_time) <= timezone('Asia/Ho_Chi_Minh', now()) then
    raise exception 'Selected time is already past.';
  end if;

  if v_user_id is null then
    v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

    if nullif(v_guest_phone, '') is null
      or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15
    then
      raise exception 'Enter a valid phone number.';
    end if;

    perform public.consume_guest_ticket_booking_rate_limit(
      v_guest_phone,
      p_date,
      p_start_time,
      p_ticket_type
    );

    select *
    into v_customer
    from public.ensure_guest_ticket_profile(v_guest_phone, v_guest_name);
  else
    select *
    into v_customer
    from public.profiles
    where id = v_user_id
      and deleted_at is null;

    if not found then
      raise exception 'Profile required to request tickets.';
    end if;
  end if;

  v_customer_id := v_customer.id;
  v_expected_unit_price := case
    when p_ticket_type <> 'individual' then 0
    when extract(dow from p_date)::integer in (0, 6) then 330000
    when v_start_minutes >= 18 * 60 then 250000
    else 200000
  end;
  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / 20)::integer);

  if p_ticket_type = 'individual' then
    if p_player_count > 8 then
      v_discount_rate := 0.15;
    elsif p_player_count > 4 then
      v_discount_rate := 0.10;
    end if;

    v_expected_total := round(
      (v_expected_unit_price * v_duration_blocks * p_player_count)::numeric * (1 - v_discount_rate)
    )::integer;
  else
    v_expected_total := 0;
  end if;

  v_ticket_reference := 'CS-' || to_char(now(), 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
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
    ticket_customer_id,
    venue_key
  ) values (
    v_customer_id,
    null,
    'game',
    'Cafe soft-opening request - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    p_arena_count,
    v_game_options,
    '{}'::jsonb,
    null,
    'private',
    v_invite_code,
    concat_ws(E'\n', 'Zalo confirmation required for Cafe des Stagiaires soft opening.', v_special_note),
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
    'pending',
    v_ticket_reference,
    v_customer_id,
    'cafe-des-stagiaires'
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
    coalesce(v_guest_name, v_customer.nickname, v_customer.full_name, v_customer.phone, 'Guest'),
    v_customer.avatar_url,
    v_customer.avatar_emoji,
    v_customer.avatar_initials,
    v_customer.avatar_color,
    v_customer.avatar_text_color,
    v_customer.profile_motto,
    v_expected_total
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'ticket_reference', v_ticket_reference,
    'booking_type', 'ticket',
    'ticket_status', 'pending',
    'ticket_unit_price', v_expected_unit_price,
    'ticket_total_price', v_expected_total,
    'venue_key', 'cafe-des-stagiaires',
    'guest_phone', case when v_user_id is null then v_guest_phone else null end,
    'guest_name', coalesce(v_guest_name, v_customer.full_name, v_customer.nickname)
  );
end;
$$;

revoke all on function public.create_cafe_ticket_booking_request(
  text, date, time without time zone, integer, integer, integer, text[], text, text, text
) from public;
grant execute on function public.create_cafe_ticket_booking_request(
  text, date, time without time zone, integer, integer, integer, text[], text, text, text
) to anon, authenticated;

comment on function public.create_cafe_ticket_booking_request(
  text, date, time without time zone, integer, integer, integer, text[], text, text, text
) is 'Creates a pending Cafe des Stagiaires soft-opening ticket request that requires Zalo confirmation.';
