begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- These rows exist only inside a validated claim transaction and are removed
-- immediately after its session UPDATE. Browser roles cannot create or use them.
create table private.guest_ticket_claim_context (
  transaction_id xid8 not null,
  session_id uuid not null,
  actor_id uuid not null,
  previous_owner_id uuid not null,
  guest_profile_id uuid not null,
  expected_game_votes jsonb not null,
  primary key (transaction_id, session_id)
);
alter table private.guest_ticket_claim_context enable row level security;
revoke all on private.guest_ticket_claim_context from public, anon, authenticated, service_role;
create policy "guest claim context denies browser access" on private.guest_ticket_claim_context
  for all to anon, authenticated using (false) with check (false);

create function private.is_authorized_guest_ticket_claim(p_old public.sessions, p_new public.sessions)
returns boolean language sql security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from private.guest_ticket_claim_context context
    where context.transaction_id = pg_current_xact_id()
      and context.session_id = p_old.id and p_new.id = p_old.id
      and context.actor_id = auth.uid()
      and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
      and p_old.booking_type = 'ticket' and p_old.ticket_status = 'confirmed'
      and p_old.deleted_at is null
      and p_old.owner_id = context.previous_owner_id
      and p_old.ticket_customer_id = context.guest_profile_id
      and p_new.owner_id = context.actor_id and p_new.ticket_customer_id = context.actor_id
      and p_new.game_votes = context.expected_game_votes
      and (to_jsonb(p_new) - array['owner_id','ticket_customer_id','game_votes','updated_at'])
        = (to_jsonb(p_old) - array['owner_id','ticket_customer_id','game_votes','updated_at'])
  )
$$;
revoke all on function private.is_authorized_guest_ticket_claim(public.sessions,public.sessions)
  from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION "private"."claim_guest_ticket_booking"("p_guest_phone" "text", "p_ticket_reference" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  -- Only this validated, locked claim can authorize the exact ownership handoff.
  insert into private.guest_ticket_claim_context (
    transaction_id, session_id, actor_id, previous_owner_id, guest_profile_id, expected_game_votes
  ) values (
    pg_catalog.pg_current_xact_id(), v_session.id, v_actor, v_session.owner_id, v_guest_profile.id,
    (coalesce(v_session.game_votes, '{}'::jsonb) - v_guest_profile.id::text) || jsonb_build_object(v_actor::text, v_vote)
  );

  update public.sessions
  set owner_id = v_actor,
      ticket_customer_id = v_actor,
      game_votes = (coalesce(game_votes, '{}'::jsonb) - v_guest_profile.id::text) || jsonb_build_object(v_actor::text, v_vote),
      updated_at = now()
  where id = v_session.id;

  delete from private.guest_ticket_claim_context
  where transaction_id = pg_catalog.pg_current_xact_id() and session_id = v_session.id;

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

CREATE OR REPLACE FUNCTION "public"."protect_session_client_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_can_manage boolean := public.can_manage_session_row(old.id);
  v_ticket_trusted_change boolean := false;
begin
  if private.is_authorized_guest_ticket_claim(old, new) then
    return new;
  end if;

  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  if old.booking_type = 'ticket' then
    v_ticket_trusted_change :=
      new.owner_id is distinct from old.owner_id
      or new.club_id is distinct from old.club_id
      or new.session_type is distinct from old.session_type
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.duration_minutes is distinct from old.duration_minutes
      or new.max_players is distinct from old.max_players
      or new.arena_count is distinct from old.arena_count
      or new.status is distinct from old.status
      or new.require_payment is distinct from old.require_payment
      or new.booking_type is distinct from old.booking_type
      or new.ticket_type is distinct from old.ticket_type
      or new.ticket_player_count is distinct from old.ticket_player_count
      or new.ticket_total_price is distinct from old.ticket_total_price
      or new.ticket_unit_price is distinct from old.ticket_unit_price
      or new.ticket_status is distinct from old.ticket_status
      or new.ticket_reference is distinct from old.ticket_reference
      or new.ticket_customer_id is distinct from old.ticket_customer_id
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.delete_reason is distinct from old.delete_reason;

    if v_ticket_trusted_change then
      raise exception 'Ticket booking payment and status fields can only be changed by staff.';
    end if;
  end if;

  if v_can_manage then
    return new;
  end if;

  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if not exists (
    select 1
    from public.session_participants sp
    where sp.session_id = old.id
      and sp.profile_id = v_actor
      and sp.deleted_at is null
  ) then
    raise exception 'Session participant access required.';
  end if;

  if new.game_votes is distinct from old.game_votes
    and new.owner_id is not distinct from old.owner_id
    and new.club_id is not distinct from old.club_id
    and new.session_type is not distinct from old.session_type
    and new.name is not distinct from old.name
    and new.date is not distinct from old.date
    and new.start_time is not distinct from old.start_time
    and new.duration_minutes is not distinct from old.duration_minutes
    and new.max_players is not distinct from old.max_players
    and new.arena_count is not distinct from old.arena_count
    and new.confirmed_game_id is not distinct from old.confirmed_game_id
    and new.visibility is not distinct from old.visibility
    and new.invite_code is not distinct from old.invite_code
    and new.notes is not distinct from old.notes
    and new.status is not distinct from old.status
    and new.tournament_format is not distinct from old.tournament_format
    and new.best_of is not distinct from old.best_of
    and new.rounds_per_match is not distinct from old.rounds_per_match
    and new.require_payment is not distinct from old.require_payment
    and new.qualification_rule is not distinct from old.qualification_rule
    and new.custom_qualifiers is not distinct from old.custom_qualifiers
    and new.enable_third_place_match is not distinct from old.enable_third_place_match
    and new.first_prize is not distinct from old.first_prize
    and new.second_prize is not distinct from old.second_prize
    and new.third_prize is not distinct from old.third_prize
    and new.tournament_locked is not distinct from old.tournament_locked
    and new.seeded is not distinct from old.seeded
    and new.seed_label is not distinct from old.seed_label
    and new.seed_batch is not distinct from old.seed_batch
    and new.booking_type is not distinct from old.booking_type
    and new.ticket_type is not distinct from old.ticket_type
    and new.ticket_player_count is not distinct from old.ticket_player_count
    and new.ticket_total_price is not distinct from old.ticket_total_price
    and new.ticket_unit_price is not distinct from old.ticket_unit_price
    and new.ticket_status is not distinct from old.ticket_status
    and new.ticket_reference is not distinct from old.ticket_reference
    and new.ticket_customer_id is not distinct from old.ticket_customer_id
    and new.challenge_target_id is not distinct from old.challenge_target_id
    and new.challenge_status is not distinct from old.challenge_status
    and new.challenge_accepted_at is not distinct from old.challenge_accepted_at
    and new.challenge_declined_at is not distinct from old.challenge_declined_at
    and new.deleted_at is not distinct from old.deleted_at
    and new.deleted_by is not distinct from old.deleted_by
    and new.delete_reason is not distinct from old.delete_reason
  then
    return new;
  end if;

  raise exception 'Only session managers can update this session field.';
end;
$$;

CREATE OR REPLACE FUNCTION "public"."protect_ticket_session_boundary"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_ticket_field_changed boolean;
  v_ticket_operational_field_changed boolean;
begin
  if private.is_authorized_guest_ticket_claim(old, new) then
    return new;
  end if;

  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  v_ticket_field_changed :=
    new.booking_type is distinct from old.booking_type
    or new.ticket_type is distinct from old.ticket_type
    or new.ticket_player_count is distinct from old.ticket_player_count
    or new.ticket_total_price is distinct from old.ticket_total_price
    or new.ticket_unit_price is distinct from old.ticket_unit_price
    or new.ticket_status is distinct from old.ticket_status
    or new.ticket_reference is distinct from old.ticket_reference
    or new.ticket_customer_id is distinct from old.ticket_customer_id;

  v_ticket_operational_field_changed :=
    (old.booking_type = 'ticket' or new.booking_type = 'ticket')
    and (
      new.owner_id is distinct from old.owner_id
      or new.club_id is distinct from old.club_id
      or new.session_type is distinct from old.session_type
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.duration_minutes is distinct from old.duration_minutes
      or new.max_players is distinct from old.max_players
      or new.arena_count is distinct from old.arena_count
      or new.status is distinct from old.status
      or new.require_payment is distinct from old.require_payment
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.delete_reason is distinct from old.delete_reason
    );

  if v_ticket_field_changed or v_ticket_operational_field_changed then
    raise exception 'Ticket booking fields can only be changed by staff.';
  end if;

  return new;
end;
$$;

commit;
