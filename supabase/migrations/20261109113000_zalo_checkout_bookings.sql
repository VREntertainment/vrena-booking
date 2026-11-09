begin;

create table public.zalo_checkout_bookings (
  checkout_token uuid primary key,
  app_id text not null,
  selection jsonb not null check (jsonb_typeof(selection) = 'object'),
  selection_fingerprint text not null check (selection_fingerprint ~ '^[a-f0-9]{64}$'),
  expected_amount integer not null check (expected_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  zmp_order_id text,
  zmp_trans_id text,
  booking_response jsonb,
  failure_message text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index zalo_checkout_bookings_order_id_idx
  on public.zalo_checkout_bookings (zmp_order_id)
  where zmp_order_id is not null;
create unique index zalo_checkout_bookings_trans_id_idx
  on public.zalo_checkout_bookings (zmp_trans_id)
  where zmp_trans_id is not null;
create index zalo_checkout_bookings_expiry_idx
  on public.zalo_checkout_bookings (expires_at);

alter table public.zalo_checkout_bookings enable row level security;
revoke all on table public.zalo_checkout_bookings from public, anon, authenticated;
grant select, insert, update, delete on table public.zalo_checkout_bookings to service_role;

create policy "clients cannot access Zalo Checkout state"
  on public.zalo_checkout_bookings
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function private.finalize_zalo_checkout_booking(
  p_checkout_token uuid,
  p_zmp_order_id text,
  p_zmp_trans_id text,
  p_selection_fingerprint text,
  p_expected_amount integer,
  p_booking_name text,
  p_booking_args jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_row public.zalo_checkout_bookings%rowtype;
  result jsonb;
  session_row public.sessions%rowtype;
  order_row public.staff_orders%rowtype;
  games text[];
  venue text;
  is_duplicate boolean := false;
begin
  if p_checkout_token is null or p_zmp_order_id is null or p_zmp_trans_id is null
    or p_expected_amount is null or p_expected_amount <= 0
    or p_booking_name not in ('create_guest_ticket_booking', 'create_cafe_ticket_booking_request')
    or jsonb_typeof(p_booking_args) is distinct from 'object'
  then
    raise exception 'Invalid Zalo Checkout booking request.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_checkout_token::text, 0));
  select * into checkout_row
  from public.zalo_checkout_bookings
  where checkout_token = p_checkout_token
  for update;

  if not found then raise exception 'Checkout request was not found.'; end if;
  if checkout_row.selection_fingerprint is distinct from p_selection_fingerprint
    or checkout_row.expected_amount is distinct from p_expected_amount
  then
    raise exception 'Checkout amount or selection does not match.';
  end if;
  if checkout_row.zmp_order_id is not null and checkout_row.zmp_order_id is distinct from p_zmp_order_id then
    raise exception 'Checkout order reference does not match.';
  end if;
  if checkout_row.zmp_trans_id is not null and checkout_row.zmp_trans_id is distinct from p_zmp_trans_id then
    raise exception 'Checkout transaction reference does not match.';
  end if;
  if checkout_row.status = 'confirmed' then
    return checkout_row.booking_response || jsonb_build_object('duplicate', true);
  end if;
  if checkout_row.status = 'failed' or checkout_row.expires_at <= now() then
    raise exception 'Checkout request is no longer active.';
  end if;

  select array_agg(value) into games from jsonb_array_elements_text(p_booking_args->'p_game_options');
  venue := case when p_booking_name = 'create_cafe_ticket_booking_request'
    then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;

  if p_booking_name = 'create_guest_ticket_booking' then
    result := public.create_guest_ticket_booking(
      p_booking_args->>'p_ticket_type', (p_booking_args->>'p_date')::date,
      (p_booking_args->>'p_start_time')::time, (p_booking_args->>'p_duration_minutes')::integer,
      (p_booking_args->>'p_player_count')::integer, (p_booking_args->>'p_arena_count')::integer,
      games, (p_booking_args->>'p_unit_price')::integer, (p_booking_args->>'p_total_price')::integer,
      p_booking_args->>'p_guest_phone', p_booking_args->>'p_guest_name', p_booking_args->>'p_guest_note'
    );
  else
    result := public.create_cafe_ticket_booking_request(
      p_booking_args->>'p_ticket_type', (p_booking_args->>'p_date')::date,
      (p_booking_args->>'p_start_time')::time, (p_booking_args->>'p_duration_minutes')::integer,
      (p_booking_args->>'p_player_count')::integer, (p_booking_args->>'p_arena_count')::integer,
      games, p_booking_args->>'p_guest_phone', p_booking_args->>'p_guest_name', p_booking_args->>'p_special_note'
    );
  end if;

  select * into session_row
  from public.sessions
  where id = (result->>'session_id')::uuid
  for update;
  if not found or session_row.venue_key is distinct from venue
    or session_row.ticket_status <> 'confirmed'
    or session_row.ticket_reference is null
  then
    raise exception 'The selected time could not be confirmed.';
  end if;

  if session_row.ticket_type = 'individual' and coalesce(session_row.ticket_total_price, 0) <> p_expected_amount then
    raise exception 'Confirmed booking amount does not match Checkout.';
  end if;

  if session_row.ticket_type = 'birthday' then
    update public.sessions
    set ticket_total_price = p_expected_amount
    where id = session_row.id;
    update public.session_participants
    set payment_amount = p_expected_amount
    where session_id = session_row.id and profile_id = session_row.ticket_customer_id;
    session_row.ticket_total_price := p_expected_amount;
  end if;

  select * into order_row from public.staff_orders where session_id = session_row.id for update;
  if not found then
    insert into public.staff_orders (
      customer_id, customer_name, customer_phone, customer_email, session_id, game_id,
      booking_date, booking_time, players_count, arena_id, subtotal, total,
      payment_method, payment_status, order_status, internal_note
    )
    select session_row.ticket_customer_id, profile.full_name, profile.phone, profile.email,
      session_row.id, (select id from public.staff_games where slug = games[1] limit 1),
      session_row.date, session_row.start_time, session_row.ticket_player_count,
      case when venue = 'cafe-des-stagiaires' then 'cafe:arena-1'
        else (select 'arena-' || min(arena_number)::text from private.arena_reservations where session_id = session_row.id) end,
      p_expected_amount, p_expected_amount, 'unpaid', 'unpaid', 'confirmed',
      'Zalo Checkout COD. Pay at venue. Reference: ' || session_row.ticket_reference
    from public.profiles profile where profile.id = session_row.ticket_customer_id
    returning * into order_row;
  else
    if exists (select 1 from public.staff_order_payments where order_id = order_row.id) then
      raise exception 'Booking already has recorded payments.';
    end if;
    update public.staff_orders
    set subtotal = p_expected_amount,
        discount_total = 0,
        total = p_expected_amount,
        payment_method = 'unpaid',
        payment_status = 'unpaid',
        order_status = 'confirmed',
        internal_note = concat_ws(E'\n', nullif(internal_note, ''),
          'Zalo Checkout COD. Pay at venue. Reference: ' || session_row.ticket_reference),
        updated_at = now()
    where id = order_row.id
    returning * into order_row;
  end if;

  result := result || jsonb_build_object(
    'totalPrice', p_expected_amount,
    'displayTotal', p_expected_amount,
    'requiresStaffConfirmation', false,
    'venue', venue,
    'date', session_row.date,
    'time', to_char(session_row.start_time, 'HH24:MI'),
    'ticketType', session_row.ticket_type,
    'order_id', order_row.id,
    'order_number', order_row.order_number
  );

  update public.zalo_checkout_bookings
  set status = 'confirmed',
      zmp_order_id = p_zmp_order_id,
      zmp_trans_id = p_zmp_trans_id,
      booking_response = result,
      selection = '{}'::jsonb,
      failure_message = null,
      confirmed_at = now(),
      updated_at = now()
  where checkout_token = p_checkout_token;

  return result || jsonb_build_object('duplicate', is_duplicate);
end;
$$;

create or replace function public.finalize_zalo_checkout_booking(
  p_checkout_token uuid,
  p_zmp_order_id text,
  p_zmp_trans_id text,
  p_selection_fingerprint text,
  p_expected_amount integer,
  p_booking_name text,
  p_booking_args jsonb
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.finalize_zalo_checkout_booking(
    p_checkout_token, p_zmp_order_id, p_zmp_trans_id, p_selection_fingerprint,
    p_expected_amount, p_booking_name, p_booking_args
  );
$$;

revoke all on function private.finalize_zalo_checkout_booking(uuid,text,text,text,integer,text,jsonb) from public;
revoke all on function public.finalize_zalo_checkout_booking(uuid,text,text,text,integer,text,jsonb) from public, anon, authenticated;
grant execute on function private.finalize_zalo_checkout_booking(uuid,text,text,text,integer,text,jsonb) to service_role;
grant execute on function public.finalize_zalo_checkout_booking(uuid,text,text,text,integer,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
