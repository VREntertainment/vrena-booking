begin;

alter table public.session_participants
add column if not exists checked_in_at timestamptz;

create or replace function public.protect_session_client_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_can_manage boolean := public.can_manage_session_row(old.id);
  v_ticket_trusted_change boolean := false;
begin
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

create or replace function public.protect_session_participant_trusted_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_session record;
  v_trusted_payment_or_check_present boolean := false;
  v_trusted_payment_or_check_changed boolean := false;
  v_result_changed boolean := false;
  v_allowed_ticket_quote_insert boolean := false;
begin
  select
    s.id,
    s.owner_id,
    s.booking_type,
    s.ticket_customer_id,
    s.ticket_total_price
  into v_session
  from public.sessions s
  where s.id = new.session_id;

  if not found then
    raise exception 'Session not found.';
  end if;

  if v_is_service_role or v_actor_rank >= 50 then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    v_trusted_payment_or_check_present :=
      coalesce(new.checked_in, false) <> false
      or new.payment_status is not null
      or new.payment_amount is not null
      or coalesce(new.payment_splits, '[]'::jsonb) <> '[]'::jsonb
      or new.checked_in_at is not null;

    if not v_trusted_payment_or_check_present then
      return new;
    end if;

    v_allowed_ticket_quote_insert :=
      v_session.booking_type = 'ticket'
      and new.profile_id = v_actor
      and new.profile_id = v_session.ticket_customer_id
      and coalesce(new.checked_in, false) = false
      and new.payment_status is null
      and new.payment_amount is not distinct from v_session.ticket_total_price
      and coalesce(new.payment_splits, '[]'::jsonb) = '[]'::jsonb
      and new.checked_in_at is null;

    if v_allowed_ticket_quote_insert then
      return new;
    end if;

    if v_session.booking_type <> 'ticket'
      and public.can_manage_session_row(new.session_id)
    then
      return new;
    end if;

    raise exception 'Only session managers can set participant payment or check-in fields.';
  end if;

  v_trusted_payment_or_check_changed :=
    new.checked_in is distinct from old.checked_in
    or new.payment_status is distinct from old.payment_status
    or new.payment_amount is distinct from old.payment_amount
    or coalesce(new.payment_splits, '[]'::jsonb) is distinct from coalesce(old.payment_splits, '[]'::jsonb)
    or new.checked_in_at is distinct from old.checked_in_at;

  v_result_changed :=
    new.score is distinct from old.score
    or new.accuracy_percent is distinct from old.accuracy_percent
    or new.projectiles_fired is distinct from old.projectiles_fired
    or new.escape_duration_seconds is distinct from old.escape_duration_seconds
    or new.placement is distinct from old.placement
    or new.prize_claimed is distinct from old.prize_claimed
    or new.prize_claimed_at is distinct from old.prize_claimed_at;

  if not v_trusted_payment_or_check_changed and not v_result_changed then
    return new;
  end if;

  if v_session.booking_type = 'ticket' then
    raise exception 'Ticket participant payment, check-in, and result fields can only be changed by staff.';
  end if;

  if public.can_manage_session_row(new.session_id) then
    return new;
  end if;

  raise exception 'Only session managers can update participant payment, check-in, or result fields.';
end;
$$;

drop trigger if exists session_participants_protect_trusted_fields on public.session_participants;
create trigger session_participants_protect_trusted_fields
before insert or update on public.session_participants
for each row execute function public.protect_session_participant_trusted_fields();

revoke all on function public.protect_session_participant_trusted_fields() from public, anon, authenticated;
grant execute on function public.protect_session_participant_trusted_fields() to service_role;

notify pgrst, 'reload schema';

commit;
