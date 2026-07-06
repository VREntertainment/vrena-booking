begin;

create or replace function public.normalize_guest_ticket_phone(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '(?!^)\+', '', 'g')
$$;

create or replace function public.profile_has_account(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users users
    where users.id = p_profile_id
  )
$$;

create or replace function public.guest_ticket_phone_account_status(p_guest_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_guest_phone text := public.normalize_guest_ticket_phone(p_guest_phone);
  v_has_account boolean := false;
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  select exists (
    select 1
    from public.profiles profiles
    where profiles.phone = v_guest_phone
      and profiles.deleted_at is null
      and public.profile_has_account(profiles.id)
  )
  into v_has_account;

  return jsonb_build_object(
    'normalized_phone', v_guest_phone,
    'has_account', coalesce(v_has_account, false)
  );
end;
$$;

create or replace function public.award_staff_order_loyalty(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.staff_orders%rowtype;
  v_rule record;
  v_points integer;
begin
  select *
  into v_order
  from public.staff_orders
  where id = p_order_id
  for update;

  if not found
    or v_order.customer_id is null
    or v_order.session_id is null
    or v_order.payment_status <> 'paid'
    or v_order.order_status in ('cancelled', 'refunded', 'no_show')
    or not public.profile_has_account(v_order.customer_id)
  then
    return;
  end if;

  for v_rule in
    select *
    from public.staff_loyalty_rules
    where active = true
      and earn_trigger = 'session_payment_confirmed'
      and valid_from <= v_order.booking_date
      and (valid_until is null or valid_until >= v_order.booking_date)
      and (game_id is null or game_id = v_order.game_id)
      and coalesce(v_order.total, 0) >= min_order_total
  loop
    v_points := case v_rule.calculation_type
      when 'per_vnd_spent' then floor((coalesce(v_order.total, 0)::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(greatest(coalesce(v_order.players_count, 0), 0)::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end;

    if v_points > 0 then
      perform public.apply_loyalty_points_delta(
        v_order.customer_id,
        v_points,
        v_rule.id,
        'staff_order',
        v_order.id,
        'Session payment confirmed',
        null
      );
    end if;
  end loop;
end;
$$;

create or replace function public.staff_order_loyalty_award_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and old.payment_status = 'paid' then
    return new;
  end if;

  perform public.award_staff_order_loyalty(new.id);
  return new;
end;
$$;

create or replace function public.claim_guest_ticket_booking(
  p_guest_phone text,
  p_ticket_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_email text;
  v_actor_profile public.profiles%rowtype;
  v_guest_phone text := public.normalize_guest_ticket_phone(p_guest_phone);
  v_ticket_reference text := upper(nullif(btrim(coalesce(p_ticket_reference, '')), ''));
  v_session public.sessions%rowtype;
  v_guest_profile public.profiles%rowtype;
  v_vote text;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  if v_ticket_reference is null then
    raise exception 'Booking reference is required.';
  end if;

  select lower(users.email)
  into v_actor_email
  from auth.users users
  where users.id = v_actor;

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    role,
    score_adjustment,
    anonymous_mode,
    marketing_consent
  )
  values (
    v_actor,
    v_guest_phone,
    null,
    null,
    v_actor_email,
    'player',
    0,
    false,
    false
  )
  on conflict (id) do nothing;

  select *
  into v_actor_profile
  from public.profiles
  where id = v_actor
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if nullif(btrim(coalesce(v_actor_profile.phone, '')), '') is null then
    update public.profiles
    set phone = v_guest_phone,
        updated_at = now()
    where id = v_actor
    returning * into v_actor_profile;
  elsif v_actor_profile.phone <> v_guest_phone then
    raise exception 'This account uses a different phone number.';
  end if;

  select *
  into v_session
  from public.sessions
  where ticket_reference = v_ticket_reference
    and booking_type = 'ticket'
    and ticket_status = 'confirmed'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Ticket booking not found.';
  end if;

  if v_session.owner_id = v_actor and v_session.ticket_customer_id = v_actor then
    perform public.award_staff_order_loyalty(orders.id)
    from public.staff_orders orders
    where orders.session_id = v_session.id;

    return jsonb_build_object(
      'session_id', v_session.id,
      'ticket_reference', v_session.ticket_reference,
      'claimed', true,
      'loyalty_points_total', coalesce(v_actor_profile.loyalty_points_total, 0)
    );
  end if;

  select *
  into v_guest_profile
  from public.profiles
  where id = v_session.ticket_customer_id
    and phone = v_guest_phone
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Ticket booking does not match this phone number.';
  end if;

  if public.profile_has_account(v_guest_profile.id) then
    raise exception 'This booking is already linked to another account.';
  end if;

  v_vote := coalesce(v_session.game_votes ->> v_guest_profile.id::text, v_session.confirmed_game_id::text, 'laser-tag');

  update public.sessions
  set owner_id = v_actor,
      ticket_customer_id = v_actor,
      game_votes = (coalesce(game_votes, '{}'::jsonb) - v_guest_profile.id::text) || jsonb_build_object(v_actor::text, v_vote),
      updated_at = now()
  where id = v_session.id;

  update public.session_participants
  set profile_id = v_actor,
      display_name = coalesce(
        nullif(display_name, ''),
        nullif(v_actor_profile.nickname, ''),
        nullif(v_actor_profile.full_name, ''),
        nullif(v_actor_profile.phone, ''),
        'Player'
      )
  where session_id = v_session.id
    and profile_id = v_guest_profile.id
    and deleted_at is null;

  update public.staff_orders
  set customer_id = v_actor,
      customer_name = coalesce(nullif(v_actor_profile.full_name, ''), nullif(v_actor_profile.nickname, ''), customer_name),
      customer_phone = v_guest_phone,
      customer_email = coalesce(v_actor_profile.email, v_actor_email, customer_email),
      updated_at = now()
  where session_id = v_session.id
    and customer_id = v_guest_profile.id;

  perform public.award_staff_order_loyalty(orders.id)
  from public.staff_orders orders
  where orders.session_id = v_session.id;

  select *
  into v_actor_profile
  from public.profiles
  where id = v_actor;

  return jsonb_build_object(
    'session_id', v_session.id,
    'ticket_reference', v_session.ticket_reference,
    'claimed', true,
    'loyalty_points_total', coalesce(v_actor_profile.loyalty_points_total, 0)
  );
end;
$$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.create_guest_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,text,text)'::regprocedure)
  into v_definition;

  if position('where phone = v_guest_phone' in v_definition) = 0 then
    raise exception 'Could not patch create_guest_ticket_booking profile lookup.';
  end if;

  v_definition := replace(
    v_definition,
    'where phone = v_guest_phone
    and deleted_at is null',
    'where phone = v_guest_phone
    and deleted_at is null
    and not public.profile_has_account(profiles.id)'
  );

  execute v_definition;
end $$;

do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.sessions_list_page(date,date,integer,integer,boolean)'::regprocedure,
    'public.session_detail(uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_function) into v_definition;

    v_definition := replace(
      v_definition,
      'or (s.visibility = ''private'' and s.booking_type is null)',
      'or (s.visibility = ''private'' and s.booking_type is null)
        or s.booking_type = ''ticket'''
    );

    v_definition := replace(
      v_definition,
      'where sp.deleted_at is null
    group by sp.session_id',
      'where sp.deleted_at is null
      and (
        s.booking_type is distinct from ''ticket''
        or v_actor_rank >= 50
        or sp.profile_id = v_actor
        or s.owner_id = v_actor
      )
    group by sp.session_id'
    );

    v_definition := replace(
      v_definition,
      '''booking_type'', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end',
      '''booking_type'', case when s.booking_type = ''ticket'' or v_actor_rank >= 50 or s.owner_id = v_actor then s.booking_type else null end'
    );

    v_definition := replace(
      v_definition,
      '''ticket_type'', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end',
      '''ticket_type'', case when s.booking_type = ''ticket'' or v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_type else null end'
    );

    v_definition := replace(
      v_definition,
      '''ticket_status'', case when v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_status else null end',
      '''ticket_status'', case when s.booking_type = ''ticket'' or v_actor_rank >= 50 or s.owner_id = v_actor then s.ticket_status else null end'
    );

    execute v_definition;
  end loop;
end $$;

revoke all on function public.normalize_guest_ticket_phone(text) from public, anon, authenticated;
revoke all on function public.profile_has_account(uuid) from public, anon, authenticated;
revoke all on function public.guest_ticket_phone_account_status(text) from public;
revoke all on function public.award_staff_order_loyalty(uuid) from public, anon, authenticated;
revoke all on function public.staff_order_loyalty_award_trigger() from public, anon, authenticated;
revoke all on function public.claim_guest_ticket_booking(text, text) from public, anon, authenticated;
revoke all on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.sessions_list_page(date, date, integer, integer, boolean) from public;
revoke all on function public.session_detail(uuid) from public;

grant execute on function public.guest_ticket_phone_account_status(text) to anon, authenticated, service_role;
grant execute on function public.claim_guest_ticket_booking(text, text) to authenticated, service_role;
grant execute on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text) to anon, authenticated, service_role;
grant execute on function public.sessions_list_page(date, date, integer, integer, boolean) to anon, authenticated, service_role;
grant execute on function public.session_detail(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
