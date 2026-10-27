begin;

-- Preserve staff/service and transaction-bound guest-claim exceptions while
-- closing player writes to venue allocation and voucher-redemption metadata.
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
      or new.venue_key is distinct from old.venue_key
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
      or new.ticket_discount_rule_id is distinct from old.ticket_discount_rule_id
      or new.ticket_discount_code is distinct from old.ticket_discount_code
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

  -- A participant can change only their own vote. Compare the whole row so
  -- newly added columns cannot silently become participant-writable.
  if new.game_votes is distinct from old.game_votes
    and (to_jsonb(new) - array['game_votes', 'updated_at'])
      = (to_jsonb(old) - array['game_votes', 'updated_at'])
    and jsonb_typeof(new.game_votes) = 'object'
    and (new.game_votes - v_actor::text)
      = (coalesce(old.game_votes, '{}'::jsonb) - v_actor::text)
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
    or new.ticket_discount_rule_id is distinct from old.ticket_discount_rule_id
    or new.ticket_discount_code is distinct from old.ticket_discount_code
    or new.ticket_customer_id is distinct from old.ticket_customer_id;

  v_ticket_operational_field_changed :=
    (old.booking_type = 'ticket' or new.booking_type = 'ticket')
    and (
      new.owner_id is distinct from old.owner_id
      or new.club_id is distinct from old.club_id
      or new.session_type is distinct from old.session_type
      or new.venue_key is distinct from old.venue_key
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
