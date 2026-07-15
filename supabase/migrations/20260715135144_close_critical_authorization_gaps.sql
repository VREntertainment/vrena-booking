begin;

do $$
declare
  v_policy record;
begin
  -- The legacy bookings table is no longer used by the application. Its old
  -- PUBLIC policies exposed customer names and phone numbers through PostgREST.
  if to_regclass('public.bookings') is null then
    return;
  end if;

  execute 'alter table public.bookings enable row level security';
  execute 'revoke all on table public.bookings from public, anon, authenticated';
  execute 'grant all on table public.bookings to service_role';

  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
  loop
    execute format('drop policy %I on public.bookings', v_policy.policyname);
  end loop;
end;
$$;

-- Replace the accumulated permissive session policies with one canonical set.
-- PostgreSQL ORs permissive policies, so retaining even one legacy USING(true)
-- or WITH CHECK(true) policy defeats every narrower policy on the same action.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sessions', 'session_participants')
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;

alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;

revoke all on table public.sessions from public, anon, authenticated;
revoke all on table public.session_participants from public, anon, authenticated;
grant select, insert, update on table public.sessions to authenticated;
grant select, insert, update on table public.session_participants to authenticated;
grant all on table public.sessions to service_role;
grant all on table public.session_participants to service_role;

create or replace function public.can_join_session_row(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.sessions s
      where s.id = p_session_id
        and s.deleted_at is null
        and s.status = 'open'
        and s.booking_type <> 'ticket'
        and (
          select count(*)
          from public.session_participants active_participant
          where active_participant.session_id = s.id
            and active_participant.deleted_at is null
        ) < s.max_players
        and (
          s.owner_id = (select auth.uid())
          or coalesce(public.current_staff_role_rank(), 0) >= 50
          or (
            s.club_id is null
            and (
              s.visibility = 'public'
              or exists (
                select 1
                from public.session_invites si
                where si.session_id = s.id
                  and si.recipient_id = (select auth.uid())
              )
            )
          )
          or (
            s.club_id is not null
            and exists (
              select 1
              from public.club_members cm
              where cm.club_id = s.club_id
                and cm.profile_id = (select auth.uid())
                and cm.status = 'approved'
                and cm.deleted_at is null
            )
          )
        )
    );
$$;

revoke all on function public.can_join_session_row(uuid) from public, anon;
grant execute on function public.can_join_session_row(uuid) to authenticated, service_role;

create policy "sessions readable by allowed users"
on public.sessions
for select
to authenticated
using (public.can_view_session_row(id));

create policy "users create own community sessions"
on public.sessions
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
  and deleted_at is null
  and status = 'open'
  and booking_type = 'community'
  and ticket_type is null
  and ticket_player_count is null
  and ticket_total_price is null
  and ticket_unit_price is null
  and ticket_status is null
  and ticket_reference is null
  and ticket_customer_id is null
  and challenge_target_id is null
  and challenge_status is null
  and challenge_accepted_at is null
  and challenge_declined_at is null
  and (
    club_id is null
    or coalesce(public.current_staff_role_rank(), 0) >= 50
    or exists (
      select 1
      from public.clubs c
      where c.id = sessions.club_id
        and c.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.club_members cm
      where cm.club_id = sessions.club_id
        and cm.profile_id = (select auth.uid())
        and cm.status = 'approved'
        and cm.deleted_at is null
    )
  )
);

create policy "session managers update sessions"
on public.sessions
for update
to authenticated
using (public.can_manage_session_row(id))
with check (public.can_manage_session_row(id));

create policy "participants update session votes"
on public.sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.session_participants sp
    where sp.session_id = sessions.id
      and sp.profile_id = (select auth.uid())
      and sp.deleted_at is null
  )
)
with check (
  exists (
    select 1
    from public.session_participants sp
    where sp.session_id = sessions.id
      and sp.profile_id = (select auth.uid())
      and sp.deleted_at is null
  )
);

-- Direct table reads are limited to the participant's own row or a session
-- manager. Public participant cards continue to come from the redacting RPCs.
create policy "session participants readable by related users"
on public.session_participants
for select
to authenticated
using (
  deleted_at is null
  and (
    profile_id = (select auth.uid())
    or public.can_manage_session_row(session_id)
  )
);

create policy "users join allowed sessions as themselves"
on public.session_participants
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and deleted_at is null
  and public.can_join_session_row(session_id)
);

create policy "session managers update participant results"
on public.session_participants
for update
to authenticated
using (deleted_at is null and public.can_manage_session_row(session_id))
with check (deleted_at is null and public.can_manage_session_row(session_id));

-- RLS prevents direct ticket inserts. This trigger separately prevents a
-- community owner from converting an existing row into a trusted ticket row.
create or replace function public.protect_ticket_session_boundary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_ticket_field_changed boolean;
  v_ticket_operational_field_changed boolean;
begin
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

drop trigger if exists sessions_protect_ticket_boundary on public.sessions;
create trigger sessions_protect_ticket_boundary
before update on public.sessions
for each row execute function public.protect_ticket_session_boundary();

revoke all on function public.protect_ticket_session_boundary() from public, anon, authenticated;
grant execute on function public.protect_ticket_session_boundary() to service_role;

-- Community sessions use booking_type = 'community'. Earlier hardening checked
-- for NULL, which made legitimate private-code sessions undiscoverable and
-- unjoinable after booking_type became NOT NULL.
do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.sessions_list_page(date,date,integer,integer,boolean)'::regprocedure,
    'public.session_detail(uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_function) into v_definition;
    v_definition := replace(
      v_definition,
      's.booking_type is null',
      's.booking_type <> ''ticket'''
    );
    execute v_definition;
  end loop;
end;
$$;

-- The generic primitive remains available to trusted server/database code only.
-- Browser clients use the fixed-configuration wrapper below.
revoke all on function public.consume_rate_limit(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer, text) to service_role;

create or replace function public.consume_user_action_rate_limit(
  p_action text,
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_limit integer;
  v_window_seconds integer;
  v_global_limit integer;
begin
  if v_actor is null or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Login required.';
  end if;

  if length(coalesce(v_subject, '')) > 180 then
    raise exception 'Rate limit subject is too long.';
  end if;

  case p_action
    when 'join_leave' then
      v_limit := 5;
      v_window_seconds := 60;
      v_global_limit := 30;
    when 'admin_destructive' then
      v_limit := 3;
      v_window_seconds := 60;
      v_global_limit := 12;
    when 'staff_config_write' then
      if coalesce(public.current_staff_role_rank(), 0) < 50 then
        raise exception 'Staff access required.';
      end if;
      v_limit := 20;
      v_window_seconds := 10 * 60;
      v_global_limit := 60;
    else
      raise exception 'Unknown rate limit action.';
  end case;

  perform public.consume_rate_limit(
    p_action,
    v_global_limit,
    v_window_seconds,
    '__actor_global__'
  );

  return public.consume_rate_limit(
    p_action,
    v_limit,
    v_window_seconds,
    coalesce(v_subject, '__default__')
  );
end;
$$;

revoke all on function public.consume_user_action_rate_limit(text, text) from public, anon;
grant execute on function public.consume_user_action_rate_limit(text, text) to authenticated, service_role;

create or replace function public.consume_booking_attempt_rate_limit(p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
begin
  if length(coalesce(v_subject, '')) > 180 then
    raise exception 'Rate limit subject is too long.';
  end if;

  perform public.consume_rate_limit(
    'booking_attempt',
    20,
    60,
    '__booking_global__'
  );

  return public.consume_rate_limit(
    'booking_attempt',
    3,
    60,
    coalesce(v_subject, '__default__')
  );
end;
$$;

revoke all on function public.consume_booking_attempt_rate_limit(text) from public;
grant execute on function public.consume_booking_attempt_rate_limit(text) to anon, authenticated, service_role;

-- This email-keyed browser RPC could be called repeatedly to lock out another
-- user in the UI while doing nothing to protect the real GoTrue login endpoint.
revoke all on function public.consume_login_attempt_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt_rate_limit(text) to service_role;

-- Keep new public-schema objects private by default. Migrations must opt in to
-- Data API access with explicit grants and RLS policies.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Deployment assertions: fail the transaction if a legacy open policy or grant
-- survived, rather than reporting success with the exploit still reachable.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sessions', 'session_participants', 'bookings')
      and (
        coalesce(qual, '') = 'true'
        or coalesce(with_check, '') = 'true'
        or 'anon' = any(roles)
        or 'public' = any(roles)
      )
  ) then
    raise exception 'Unsafe public session or booking policy remains.';
  end if;

  if to_regclass('public.bookings') is not null then
    if has_table_privilege('anon', 'public.bookings', 'select')
      or has_table_privilege('anon', 'public.bookings', 'insert')
      or has_table_privilege('authenticated', 'public.bookings', 'select')
    then
      raise exception 'Legacy bookings table remains exposed.';
    end if;
  end if;

  if has_function_privilege('authenticated', 'public.consume_rate_limit(text,integer,integer,text)', 'execute')
    or has_function_privilege('anon', 'public.consume_login_attempt_rate_limit(text)', 'execute')
  then
    raise exception 'Unsafe rate-limit RPC grant remains.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
