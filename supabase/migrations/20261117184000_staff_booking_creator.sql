-- Creator attribution stays in the staff-only detail RPC, never public session data.
create or replace function public.staff_get_booking_details(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 creator_name text;
 creator_via_pin boolean;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if not exists(select 1 from staff_location_scope.sessions where id=p_session_id and deleted_at is null) then raise exception 'Booking not found.'; end if;

 -- Use creation events only: later edits, payments and PIN switches must not
 -- change who originally reserved. Audit actor IDs retain PIN attribution even
 -- after the short-lived private operator session has been removed.
 select coalesce(nullif(trim(p.full_name),''), 'Unknown staff'), a.operator_session_id is not null
 into creator_name, creator_via_pin
 from (
   select a.* from public.audit_logs a
   where a.entity_type='sessions' and a.entity_id=p_session_id and a.action='kiosk_insert'
   union all
   select a.* from public.staff_orders o
   join public.audit_logs a on a.entity_type='staff_orders' and a.entity_id=o.id and a.action='order_created'
   where o.session_id=p_session_id
 ) a
 left join public.profiles p on p.id=a.actor_user_id
 where a.actor_user_id is not null
 order by a.created_at, case when a.entity_type='sessions' then 0 else 1 end, a.id
 limit 1;

 return (select to_jsonb(s)||private.calendar_booking_metadata(s.id)||jsonb_build_object(
   'booking_creator_name', creator_name,
   'booking_creator_via_pin', coalesce(creator_via_pin,false)
 ) from public.sessions s where s.id=p_session_id);
end $$;
revoke all on function public.staff_get_booking_details(uuid) from public,anon;
grant execute on function public.staff_get_booking_details(uuid) to authenticated;
