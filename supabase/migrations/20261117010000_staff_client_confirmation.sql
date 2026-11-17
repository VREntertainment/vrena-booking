-- Human contact confirmation is independent of automatic reservation/payment status.
create table private.booking_client_confirmations (
 session_id uuid primary key references public.sessions(id) on delete cascade,
 confirmed boolean not null,
 confirmed_at timestamptz,
 updated_at timestamptz not null default now(),
 confirmed_by uuid not null
);
revoke all on private.booking_client_confirmations from public, anon, authenticated;
alter table private.booking_client_confirmations enable row level security;

create or replace function private.save_booking_client_confirmation(p_session_id uuid,p_booking jsonb)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_before boolean; v_after boolean;
begin
 if not (p_booking ? 'client_confirmed') then return; end if;
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if not exists(select 1 from staff_location_scope.sessions where id=p_session_id and deleted_at is null) then raise exception 'Booking not found.'; end if;
 if jsonb_typeof(p_booking->'client_confirmed') is distinct from 'boolean' then raise exception 'Invalid client confirmation.'; end if;
 v_after:=(p_booking->>'client_confirmed')::boolean;
 v_before:=(private.calendar_booking_metadata(p_session_id)->>'client_confirmed')::boolean;
 if v_before=v_after then return; end if;
 insert into private.booking_client_confirmations(session_id,confirmed,confirmed_at,confirmed_by)
 values(p_session_id,v_after,case when v_after then now() end,auth.uid())
 on conflict(session_id) do update set confirmed=excluded.confirmed,confirmed_at=excluded.confirmed_at,confirmed_by=excluded.confirmed_by,updated_at=now();
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value)
 values(auth.uid(),'staff_client_confirmation_updated','sessions',p_session_id,
 jsonb_build_object('client_confirmed',v_before),jsonb_build_object('client_confirmed',v_after));
end $fn$;
revoke all on function private.save_booking_client_confirmation(uuid,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.calendar_booking_metadata(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
  'booking_category',coalesce(s.booking_category,case when s.ticket_type='birthday' then 'birthday' when s.ticket_type='corporate' or s.notes like '%Event / corporate; reserved minutes:%' then 'event' else 'standard' end),
  'booking_source',s.booking_source,
  'client_confirmed',case when coalesce(public.current_staff_role_rank(),0)>=50 then coalesce((select c.confirmed from private.booking_client_confirmations c where c.session_id=s.id),
    -- POS references are assigned by the staff console, never by online checkout.
    s.ticket_reference like 'POS-%' and exists(select 1 from public.staff_orders o where o.session_id=s.id and o.created_by is not null and o.order_status='confirmed'),false) else false end,
  'game_selection_explicit',coalesce(s.game_selection_explicit,
    (s.confirmed_game_id='sim-racing' or s.ticket_reference like 'POS-%' or exists(
      select 1 from public.audit_logs a where a.entity_id=s.id and a.entity_type='sessions' and a.action='staff_calendar_booking_updated'
      and nullif(a.new_value->>'game_slug','') is not null and a.new_value->>'game_slug'=s.confirmed_game_id
    )) is true)
 ) from public.sessions s where s.id=p_id;
$function$;

create or replace function public.staff_update_booking_details(p_session_id uuid,p_booking jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 result:=private.staff_update_booking_details(p_session_id,p_booking);
 perform private.save_booking_client_confirmation(p_session_id,p_booking);
 return result;
end $fn$;
create or replace function public.staff_update_sim_racing_booking(p_session_id uuid,p_booking jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 result:=private.staff_update_sim_racing_booking(p_session_id,p_booking);
 perform private.save_booking_client_confirmation(p_session_id,p_booking);
 return result;
end $fn$;
