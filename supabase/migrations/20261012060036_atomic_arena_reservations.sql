begin;

-- One physical resource per reservation, shared by every writer. The exclusion
-- constraint is the final arbiter even at REPEATABLE READ / stale snapshots.
-- Existing future conflicts deliberately abort this migration; staff must resolve
-- them explicitly. Historical bookings and pending statuses are not rewritten.
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create extension if not exists btree_gist with schema extensions;

create table private.arena_reservations (
  session_id uuid references public.sessions(id) on delete cascade,
  blocked_time_id uuid references public.blocked_times(id) on delete cascade,
  venue_key text not null,
  arena_number integer not null,
  during tsrange not null,
  check (num_nonnulls(session_id, blocked_time_id) = 1),
  check ((venue_key = 'cafe-des-stagiaires' and arena_number = 1)
    or (venue_key = 'ha-do-centrosa' and arena_number in (1, 2))),
  check (not isempty(during) and not lower_inf(during) and not upper_inf(during)
    and lower_inc(during) and not upper_inc(during)),
  exclude using gist (venue_key with =, arena_number with =, during with &&)
);
create index on private.arena_reservations(session_id);
create index on private.arena_reservations(blocked_time_id);
alter table private.arena_reservations enable row level security;
revoke all on private.arena_reservations from public, anon, authenticated;

create function private.reserve_arenas(p_session uuid, p_block uuid, p_venue text,
  p_start timestamp, p_end timestamp, p_count integer, p_preferred integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_capacity integer; v_arena integer; v_selected integer[]; v_range tsrange;
begin
  v_capacity := case p_venue when 'cafe-des-stagiaires' then 1 when 'ha-do-centrosa' then 2 end;
  if v_capacity is null or p_count is null or p_count not between 1 and v_capacity
    or p_start is null or p_end is null or p_end <= p_start
    or p_end > date_trunc('day',p_start) + interval '1 day'
    or (p_preferred is not null and p_preferred not between 1 and v_capacity) then
    raise exception 'Invalid arena reservation.';
  end if;
  v_range := tsrange(p_start,p_end,'[)');
  -- All sources share this lock. Exclusion also protects against snapshots that
  -- were taken before a competing transaction committed.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('arena:'||p_venue||':'||p_start::date::text,0));
  delete from private.arena_reservations where session_id=p_session or blocked_time_id=p_block;
  for v_arena in select n from generate_series(1,v_capacity) n
    where p_count=2 or p_preferred is null or n=p_preferred order by n
  loop
    if not exists(select 1 from private.arena_reservations r
      where r.venue_key=p_venue and r.arena_number=v_arena and r.during && v_range) then
      v_selected := array_append(v_selected,v_arena);
    end if;
    exit when cardinality(v_selected)=p_count;
  end loop;
  if coalesce(cardinality(v_selected),0) <> p_count then
    raise exception using errcode='23P01', message='Selected time slot is no longer available. Choose another arena or time.';
  end if;
  insert into private.arena_reservations(session_id,blocked_time_id,venue_key,arena_number,during)
    select p_session,p_block,p_venue,n,v_range from unnest(v_selected) n;
end $$;
revoke all on function private.reserve_arenas(uuid,uuid,text,timestamp,timestamp,integer,integer) from public,anon,authenticated;

create function private.sync_session_arenas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_preferred integer;
begin
  if new.status <> 'open' or new.deleted_at is not null
    or coalesce(new.ticket_status,'') in ('cancelled','completed') or new.arena_count=0 then
    delete from private.arena_reservations where session_id=new.id;
  else
    -- Retain the physical assignment when it still fits the new interval.
    select min(r.arena_number) into v_preferred from private.arena_reservations r
      where r.session_id=new.id and r.venue_key=new.venue_key;
    if exists(select 1 from private.arena_reservations r where r.session_id is distinct from new.id
      and r.venue_key=new.venue_key and r.arena_number=v_preferred
      and r.during && tsrange(new.date+new.start_time::time,
        new.date+new.start_time::time+make_interval(mins=>new.duration_minutes),'[)')) then
      v_preferred := null;
    end if;
    perform private.reserve_arenas(new.id,null,new.venue_key,new.date+new.start_time::time,
      new.date+new.start_time::time+make_interval(mins=>new.duration_minutes),new.arena_count,v_preferred);
    -- Keep operational arena labels consistent after a direct session move.
    update public.staff_orders set arena_id=case when new.venue_key='cafe-des-stagiaires' then 'cafe:arena-1'
      else 'arena-'||(select min(arena_number)::text from private.arena_reservations where session_id=new.id) end
      where session_id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.sync_session_arenas() from public,anon,authenticated;
create trigger sessions_reserve_arenas after insert or update of date,start_time,duration_minutes,arena_count,venue_key,status,ticket_status,deleted_at
  on public.sessions for each row execute function private.sync_session_arenas();

create function private.sync_blocked_arenas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Existing blocked_times are explicitly Ha Do only (no venue column).
  perform private.reserve_arenas(null,new.id,'ha-do-centrosa',new.date+new.start_time,
    new.date+new.end_time,new.arenas_used);
  return new;
end $$;
revoke all on function private.sync_blocked_arenas() from public,anon,authenticated;
create trigger blocked_times_reserve_arenas after insert or update on public.blocked_times
  for each row execute function private.sync_blocked_arenas();

create function private.sync_order_arena() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.sessions%rowtype; v_arena integer;
begin
  select * into s from public.sessions where id=new.session_id for update;
  if not found or s.arena_count=0 or s.status<>'open' or s.deleted_at is not null
    or coalesce(s.ticket_status,'') in ('cancelled','completed') then return new; end if;
  v_arena := case new.arena_id when 'arena-1' then 1 when 'arena-2' then 2 when 'cafe:arena-1' then 1 end;
  if v_arena is null or (s.venue_key='cafe-des-stagiaires') is distinct from (new.arena_id='cafe:arena-1') then
    raise exception 'Arena does not belong to the booking venue.';
  end if;
  perform private.reserve_arenas(s.id,null,s.venue_key,s.date+s.start_time::time,
    s.date+s.start_time::time+make_interval(mins=>s.duration_minutes),s.arena_count,v_arena);
  return new;
end $$;
revoke all on function private.sync_order_arena() from public,anon,authenticated;
create trigger staff_orders_reserve_arena after insert or update of arena_id,session_id on public.staff_orders
  for each row execute function private.sync_order_arena();

-- Lock writers through the backfill; never publish a partially populated ledger.
lock table public.sessions,public.blocked_times,public.staff_orders in share row exclusive mode;
do $$
declare r record; v_preferred integer;
begin
  for r in select * from public.blocked_times where date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date order by date,start_time,id loop
    perform private.reserve_arenas(null,r.id,'ha-do-centrosa',r.date+r.start_time,r.date+r.end_time,r.arenas_used);
  end loop;
  for r in select * from public.sessions where date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
    and status='open' and deleted_at is null and coalesce(ticket_status,'') not in ('cancelled','completed') and arena_count>0
    order by date,start_time,id loop
    select case o.arena_id when 'arena-1' then 1 when 'arena-2' then 2 when 'cafe:arena-1' then 1 end
      into v_preferred from public.staff_orders o where o.session_id=r.id order by o.created_at limit 1;
    perform private.reserve_arenas(r.id,null,r.venue_key,r.date+r.start_time::time,
      r.date+r.start_time::time+make_interval(mins=>r.duration_minutes),r.arena_count,v_preferred);
  end loop;
end $$;

-- Public occupancy contains no customer, booking ID, reference, or notes.
create function public.booking_arena_occupancy(p_from date,p_to date)
returns table(venue_key text,date date,start_time time,duration_minutes integer,arena_number integer)
language sql stable security definer set search_path = '' as $$
  select r.venue_key,lower(r.during)::date,lower(r.during)::time,
    (extract(epoch from (upper(r.during)-lower(r.during)))/60)::integer,r.arena_number
  from private.arena_reservations r
  where p_to >= p_from and p_to-p_from <= 62
    and r.during && tsrange(p_from::timestamp,(p_to+1)::timestamp,'[)');
$$;
revoke all on function public.booking_arena_occupancy(date,date) from public;
grant execute on function public.booking_arena_occupancy(date,date) to anon,authenticated,service_role;

-- Keep existing validation, pricing, auth and return shapes; change only status
-- and use the arena actually reserved by the database for guest orders.
CREATE OR REPLACE FUNCTION public.create_cafe_ticket_booking_request(p_ticket_type text, p_date date, p_start_time time without time zone, p_duration_minutes integer, p_player_count integer, p_arena_count integer, p_game_options text[], p_guest_phone text DEFAULT NULL::text, p_guest_name text DEFAULT NULL::text, p_special_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  perform private.guard_duplicate_ticket_booking(
    'cafe-des-stagiaires', auth.uid(), p_guest_phone,
    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count
  );
  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_date < date '2026-08-31' then
    raise exception 'VRena Thao Dien bookings open on August 31.';
  end if;

  if p_player_count is null or p_player_count < 1 or p_player_count > 16
    or p_arena_count is null or p_player_count > p_arena_count * 16
  then
    raise exception 'Invalid player count.';
  end if;

  if p_ticket_type = 'birthday' and p_player_count < 4 then
    raise exception 'Birthday bookings need at least 4 players.';
  end if;

  if p_ticket_type = 'corporate' and p_player_count < 6 then
    raise exception 'Corporate bookings need at least 6 players.';
  end if;

  if p_arena_count is distinct from 1 then
    raise exception 'VRena Thao Dien bookings use one arena.';
  end if;

  if p_arena_count = 2 and p_player_count <= 4 then
    raise exception 'Two arenas require at least five players.';
  end if;

  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < public.ticket_minimum_duration_minutes('cafe-des-stagiaires', p_date, p_player_count, p_arena_count) then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60
    + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 15 * 60 + 30 or v_end_minutes > 23 * 60 then
    raise exception 'Selected time is outside VRena Thao Dien opening hours.';
  end if;

  if public.ticket_booking_start_is_past(p_date, p_start_time) then
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
  v_expected_unit_price := public.ticket_tariff_unit_price(
    'cafe-des-stagiaires',
    p_ticket_type,
    p_date,
    p_start_time
  );
  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))::integer);

  if p_ticket_type = 'individual' then
    if (v_duration_blocks * public.ticket_billed_players_per_block('cafe-des-stagiaires', p_date, p_player_count, p_arena_count)) between 9 and 16 then
      v_discount_rate := 0.05;
    elsif (v_duration_blocks * public.ticket_billed_players_per_block('cafe-des-stagiaires', p_date, p_player_count, p_arena_count)) between 5 and 8 then
      v_discount_rate := 0.05;
    end if;

    v_expected_total := round(
      (v_expected_unit_price * v_duration_blocks * public.ticket_billed_players_per_block('cafe-des-stagiaires', p_date, p_player_count, p_arena_count))::numeric * (1 - v_discount_rate)
    )::integer;
  else
    v_expected_total := 0;
  end if;

  v_ticket_reference := 'TD-' || to_char(now(), 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  perform set_config('app.cafe_booking_request', '1', true);

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
    'VRena Thao Dien - ' || initcap(replace(p_ticket_type, '_', ' ')),
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
    concat_ws(E'\n', 'Online booking confirmed.', v_special_note),
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
    'ticket_status', 'confirmed',
    'ticket_unit_price', v_expected_unit_price,
    'ticket_total_price', v_expected_total,
    'venue_key', 'cafe-des-stagiaires',
    'guest_phone', case when v_user_id is null then v_guest_phone else null end,
    'guest_name', coalesce(v_guest_name, v_customer.full_name, v_customer.nickname)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_guest_ticket_booking(p_ticket_type text, p_date date, p_start_time time without time zone, p_duration_minutes integer, p_player_count integer, p_arena_count integer, p_game_options text[], p_unit_price integer, p_total_price integer, p_guest_phone text, p_guest_name text DEFAULT NULL::text, p_guest_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer_id uuid;
  v_customer public.profiles%rowtype;
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_guest_note text := left(nullif(btrim(coalesce(p_guest_note, '')), ''), 500);
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
  v_charged_players_per_block numeric;
  v_charged_player_spots numeric;
  v_expected_unit_price integer;
  v_expected_total integer;
  v_order_id uuid;
  v_order_number text;
begin

  perform private.guard_duplicate_ticket_booking(
    'ha-do-centrosa', null, p_guest_phone,
    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count
  );
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  perform public.consume_guest_ticket_booking_rate_limit(
    v_guest_phone,
    p_date,
    p_start_time,
    p_ticket_type
  );

  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_ticket_type = 'individual' then
    v_guest_note := null;
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_player_count is null or p_player_count < 1 or p_player_count > 16
    or p_arena_count is null
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
    raise exception 'Ticket bookings can reserve one or two arenas.';
  end if;



  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < public.ticket_minimum_duration_minutes('ha-do-centrosa', p_date, p_player_count, p_arena_count) then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if public.ticket_booking_start_is_past(p_date, p_start_time) then
    raise exception 'Selected time is already past.';
  end if;

  v_expected_unit_price := public.ticket_tariff_unit_price(
    'ha-do-centrosa',
    p_ticket_type,
    p_date,
    p_start_time
  );

  if p_unit_price <> v_expected_unit_price then
    raise exception 'Ticket unit price does not match the selected tariff.';
  end if;

  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))::integer);
  v_charged_players_per_block := public.ticket_billed_players_per_block('ha-do-centrosa', p_date, p_player_count, p_arena_count);
  v_charged_player_spots := v_duration_blocks * v_charged_players_per_block;

  if p_ticket_type = 'individual' then
    if (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 9 and 16 then
      v_discount_rate := 0.05;
    elsif (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 5 and 8 then
      v_discount_rate := 0.05;
    end if;

    v_expected_total := round((v_expected_unit_price * v_charged_player_spots)::numeric * (1 - v_discount_rate))::integer;
  else
    v_expected_total := 0;
  end if;

  if p_total_price <> v_expected_total then
    raise exception 'Ticket price does not match the reserved capacity.';
  end if;

  -- Physical arena allocation is enforced atomically by the sessions trigger.

  select *
  into v_customer
  from public.ensure_guest_ticket_profile(v_guest_phone, v_guest_name);

  v_customer_id := v_customer.id;

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
    p_arena_count,
    array[]::text[],
    '{}'::jsonb,
    null,
    'private',
    v_invite_code,
    coalesce(v_guest_note, 'Guest ticket booking'),
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
    (select 'arena-' || min(arena_number)::text from private.arena_reservations where session_id=v_session_id),
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
$function$
;


CREATE OR REPLACE FUNCTION public.create_ticket_booking(p_ticket_type text, p_date date, p_start_time time without time zone, p_duration_minutes integer, p_player_count integer, p_arena_count integer, p_game_options text[], p_unit_price integer, p_total_price integer, p_loyalty_points_to_redeem integer DEFAULT 0, p_discount_code text DEFAULT NULL::text, p_special_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_special_note text := left(nullif(btrim(coalesce(p_special_note, '')), ''), 500);
  v_auto_discount_rate numeric := 0;
  v_auto_discount integer := 0;
  v_auto_discount_rule_id uuid := null;
  v_duration_blocks integer;
  v_charged_players_per_block numeric;
  v_charged_player_spots numeric;
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

  perform private.guard_duplicate_ticket_booking(
    'ha-do-centrosa', auth.uid(), null,
    p_ticket_type, p_date, p_start_time, p_duration_minutes, p_player_count, p_arena_count
  );
  if v_user_id is null then
    raise exception 'Login required to book tickets.';
  end if;

  if p_ticket_type not in ('individual', 'birthday', 'corporate') then
    raise exception 'Invalid ticket type.';
  end if;

  if p_ticket_type = 'individual' then
    v_special_note := null;
  end if;

  if p_date is null or p_start_time is null or p_duration_minutes is null then
    raise exception 'Date, time, and duration are required.';
  end if;

  if p_player_count is null or p_player_count < 1 or p_player_count > 16
    or p_arena_count is null
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
    raise exception 'Ticket bookings can reserve one or two arenas.';
  end if;



  if p_duration_minutes <= 0 or p_duration_minutes > 240 or p_duration_minutes % public.ticket_tariff_price_block_minutes(p_date) <> 0 then
    raise exception 'Invalid booking duration.';
  end if;

  if p_duration_minutes < public.ticket_minimum_duration_minutes('ha-do-centrosa', p_date, p_player_count, p_arena_count) then
    raise exception 'Ticket duration is below the minimum for the selected players and arenas.';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  v_end_minutes := v_start_minutes + p_duration_minutes;

  if v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  if public.ticket_booking_start_is_past(p_date, p_start_time) then
    raise exception 'Selected time is already past.';
  end if;

  if p_ticket_type <> 'individual' then
    v_discount_code := null;
    v_loyalty_points_to_redeem := 0;
  end if;

  v_expected_unit_price := public.ticket_tariff_unit_price(
    'ha-do-centrosa',
    p_ticket_type,
    p_date,
    p_start_time
  );

  if p_ticket_type <> 'individual' then
    v_expected_unit_price := 0;
  end if;

  if p_unit_price <> v_expected_unit_price then
    raise exception 'Ticket unit price does not match the selected tariff.';
  end if;

  v_duration_blocks := greatest(1, ceil(p_duration_minutes::numeric / public.ticket_tariff_price_block_minutes(p_date))::integer);
  v_charged_players_per_block := public.ticket_billed_players_per_block('ha-do-centrosa', p_date, p_player_count, p_arena_count);
  v_charged_player_spots := v_duration_blocks * v_charged_players_per_block;
  v_expected_gross := v_expected_unit_price * v_charged_player_spots;

  select quote.discount_rule_id, quote.discount_amount
  into v_auto_discount_rule_id, v_auto_discount
  from public.ticket_automatic_discount_quote(
    p_date,
    v_expected_gross,
    v_expected_unit_price,
    coalesce(v_game_options[1], 'laser-tag'),
    p_player_count,
    p_start_time,
    p_ticket_type
  ) as quote
  limit 1;

  v_auto_discount := coalesce(v_auto_discount, 0);
  -- Match the browser's built-in billed-slot discount even when no configured
  -- automatic rule matches. Other offers retain the existing best-offer policy.
  if p_ticket_type = 'individual' and round(v_expected_gross * case
    when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 9 and 16 then 0.05
    when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 5 and 8 then 0.05 else 0 end)::integer > v_auto_discount then
    v_auto_discount := round(v_expected_gross * case
      when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 9 and 16 then 0.05
      when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 5 and 8 then 0.05 else 0 end)::integer;
    v_auto_discount_rule_id := null;
  end if;

  if v_discount_code is not null then
    select *
    into v_discount
    from public.staff_discount_rules
    where code is not null
      and lower(btrim(code)) = lower(v_discount_code)
      and active = true
      and valid_from <= p_date
      and (valid_until is null or valid_until >= p_date)
      and public.staff_discount_rule_matches_context(
        game_id,
        public.staff_ticket_price_rule_id(coalesce(v_game_options[1], 'laser-tag'), p_date, p_start_time),
        min_players,
        max_players,
        day_scope,
        time_start,
        time_end,
        ticket_type,
        min_order_total,
        per_customer_limit,
        id,
        coalesce(v_game_options[1], 'laser-tag'),
        public.staff_ticket_price_rule_id(coalesce(v_game_options[1], 'laser-tag'), p_date, p_start_time),
        p_date,
        p_start_time,
        p_player_count,
        v_expected_gross,
        p_ticket_type,
        v_user_id
      )
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

    v_voucher_discount := public.staff_discount_rule_amount(
      v_discount.discount_type,
      v_discount.value,
      v_expected_gross,
      v_expected_unit_price,
      v_discount.max_discount_amount
    );

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
      and public.staff_loyalty_rule_matches_game(r.game_id, coalesce(v_game_options[1], 'laser-tag'));

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

  -- Physical arena allocation is enforced atomically by the sessions trigger.

  if v_discount_source = 'voucher' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_auto_discount_rule_id is not null and v_auto_discount > 0 then
    select claim.discount_amount
    into v_auto_discount
    from public.claim_ticket_automatic_discount(
      v_auto_discount_rule_id,
      p_date,
      v_expected_gross,
      v_expected_unit_price,
      coalesce(v_game_options[1], 'laser-tag'),
      p_player_count,
      p_start_time,
      p_ticket_type,
      v_user_id
    ) as claim
    limit 1;

    if not found or v_auto_discount is distinct from v_applied_discount then
      raise exception 'Automatic discount is no longer available for this booking.';
    end if;
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
    ticket_customer_id,
    ticket_discount_rule_id,
    ticket_discount_code
  ) values (
    v_user_id,
    null,
    'game',
    'Ticket booking - ' || initcap(replace(p_ticket_type, '_', ' ')),
    p_date,
    p_start_time,
    p_duration_minutes,
    p_player_count,
    p_arena_count,
    array[]::text[],
    '{}'::jsonb,
    null,
    'private',
    v_invite_code,
    coalesce(v_special_note, 'Private ticket booking'),
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
    v_user_id,
    case
      when v_discount_source = 'voucher' then v_discount.id
      when v_auto_discount_rule_id is not null and v_auto_discount > 0 then v_auto_discount_rule_id
      else null
    end,
    v_applied_discount_code
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
$function$
;

notify pgrst, 'reload schema';
commit;
